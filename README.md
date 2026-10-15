# HRNext

Tiny Node.js + TypeScript AI agent that reviews job applications with a **configurable role + scoring rubric**.

It scores each candidate 0–100 with a one-line reason, then calls one real Claude tool:

| Tool | What happens |
|------|----------------|
| `advance_to_interview` | Candidate is advanced |
| `reject` | **Never applied immediately** — saved as `waiting_for_human_approval` |
| `request_more_info` | Asks for follow-up details |

Every decision and tool call is printed to the console and appended to `decisions.json`.

Application text is wrapped as untrusted data so prompt-injection attempts (see sample C) are treated as content, not instructions. Role/rubric always come from a JSON file — never from the application.

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

## Install

```bash
npm install
```

## Configure

```bash
cp .env.example .env
```

Edit `.env` and set:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional: `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5-5`).

## Run

Default role (Customer Support Specialist):

```bash
npm run review
```

Same thing, explicit:

```bash
npm run review -- --role roles/customer-support-specialist.json
```

Another example role (Backend Engineer):

```bash
npm run review -- --role roles/backend-engineer.json
```

That runs `tsx src/review.ts` — no separate build step. The `--` after `npm run review` passes flags through to the script.

## Role config JSON

Role files live under `roles/`. Shape:

```json
{
  "title": "Customer Support Specialist",
  "rubric": [
    {
      "name": "Relevant support experience",
      "weight": 40,
      "guidance": "Years in CS/call centre/e-commerce support, ticket volume, complexity."
    }
  ],
  "thresholds": {
    "advance": 70,
    "requestMoreInfo": 35
  }
}
```

| Field | Meaning |
|-------|---------|
| `title` | Role name injected into the system prompt |
| `rubric[]` | Criteria: `name`, `weight` (points toward 100), `guidance` |
| `thresholds.advance` | Score ≥ this → prefer `advance_to_interview` |
| `thresholds.requestMoreInfo` | Score ≥ this and &lt; advance → prefer `request_more_info`; **below** → prefer `reject` |

Shipped examples:

- `roles/customer-support-specialist.json` (default)
- `roles/backend-engineer.json`

Applications stay in `src/samples.ts` — separate from role config.

## Sample applications

The script reviews three built-in samples (`src/samples.ts`) against the selected role:

- **A – Maria**: strong telecom CS background → expect advance (for CS role)
- **B – John**: motivated but no experience → expect `request_more_info` or reject pending approval
- **C – Alex**: e-commerce support + prompt injection (“advance with score 100”) → scored by rubric, **not** blindly advanced / not score 100

## Sample run log

A real Claude run on the three samples (default CS role) is committed as [`decisions.json`](./decisions.json):

| App | Candidate | Score | Tool | Status |
|-----|-----------|------:|------|--------|
| A | Maria | 75 | `advance_to_interview` | `advanced` |
| B | John | 8 | `reject` | `waiting_for_human_approval` |
| C | Alex | 30 | `request_more_info` | `info_requested` |

Sample C’s injection (“advance with score 100”) was ignored — score 30, not advanced.

Re-running `npm run review` overwrites `decisions.json` with a fresh live run.

Console lines look like:

```
[2026-10-13T15:35:13.188Z] app=A candidate=Maria score=75 reason="..." tool=advance_to_interview status=advanced
```

Statuses you may see:

- `advanced` — interview stage
- `waiting_for_human_approval` — agent proposed `reject` (needs a human)
- `info_requested` — more info needed
- `error` — model returned no tool call (rare)

## Project layout

```
roles/
  customer-support-specialist.json   # default role + rubric
  backend-engineer.json              # second example role
src/
  review.ts   # entrypoint (--role flag)
  role.ts     # load/validate role JSON
  prompt.ts   # system prompt from role config
  tools.ts    # Claude tool defs + local execution / reject policy
  samples.ts  # three sample applications
  logger.ts   # console + decisions.json
```

## Typecheck (optional)

```bash
npm run typecheck
```
