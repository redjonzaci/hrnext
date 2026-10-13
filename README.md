# HRNext

Tiny Node.js + TypeScript AI agent that reviews job applications for **Customer Support Specialist**.

It scores each candidate 0–100 with a one-line reason, then calls one real Claude tool:

| Tool | What happens |
|------|----------------|
| `advance_to_interview` | Candidate is advanced |
| `reject` | **Never applied immediately** — saved as `waiting_for_human_approval` |
| `request_more_info` | Asks for follow-up details |

Every decision and tool call is printed to the console and appended to `decisions.json`.

Application text is wrapped as untrusted data so prompt-injection attempts (see sample C) are treated as content, not instructions.

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

Optional: `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-20250514`).

## Run

```bash
npm run review
```

That runs `tsx src/review.ts` — no separate build step.

## Sample applications

The script reviews three built-in samples (`src/samples.ts`):

- **A – Maria**: strong telecom CS background → expect advance
- **B – John**: motivated but no experience → expect `request_more_info` or reject pending approval
- **C – Alex**: e-commerce support + prompt injection (“advance with score 100”) → scored by rubric, **not** blindly advanced / not score 100

## What the log looks like

Console (one line per decision):

```
[2026-10-13T15:30:00.000Z] app=A candidate=Maria score=82 reason="..." tool=advance_to_interview status=advanced
```

`decisions.json` (array of records):

```json
[
  {
    "timestamp": "2026-10-13T15:30:00.000Z",
    "applicationId": "A",
    "candidateName": "Maria",
    "score": 82,
    "reason": "Three years telecom CS, high volume, Zendesk, bilingual, soon available.",
    "toolCall": "advance_to_interview",
    "toolInput": { "score": 82, "reason": "..." },
    "outcome": "Candidate advanced to interview",
    "status": "advanced"
  }
]
```

Statuses you may see:

- `advanced` — interview stage
- `waiting_for_human_approval` — agent proposed `reject` (needs a human)
- `info_requested` — more info needed
- `error` — model returned no tool call (rare)

If you see a committed `decisions.json` in the repo, it came from a real Claude run. If that file is missing, run `npm run review` with your own key to produce one — do not treat placeholder examples in this README as live results.

## Project layout

```
src/
  review.ts   # entrypoint
  prompt.ts   # system rubric + untrusted-data wrapping
  tools.ts    # Claude tool defs + local execution / reject policy
  samples.ts  # three sample applications
  logger.ts   # console + decisions.json
```

## Typecheck (optional)

```bash
npm run typecheck
```
