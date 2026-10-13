/**
 * HRNext — review Customer Support Specialist applications via Claude tool calling.
 *
 * Run: npm install && npm run review
 * Requires ANTHROPIC_API_KEY in .env (see .env.example).
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { APPLICATIONS } from "./samples.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import { resetLog, logDecision, logNote, getLogPath } from "./logger.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    console.error(`
Missing ANTHROPIC_API_KEY.

1. Copy .env.example → .env
2. Set ANTHROPIC_API_KEY=sk-ant-...
3. Run again: npm run review
`);
    process.exit(1);
  }
  return key;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function reviewOne(
  client: Anthropic,
  application: (typeof APPLICATIONS)[number],
): Promise<void> {
  logNote(`\n── Reviewing application ${application.id} (${application.name}) ──`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: TOOL_DEFINITIONS,
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: buildUserMessage(application.text),
      },
    ],
  });

  const toolBlocks = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (toolBlocks.length === 0) {
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .slice(0, 200);
    logDecision({
      timestamp: new Date().toISOString(),
      applicationId: application.id,
      candidateName: application.name,
      score: null,
      reason: null,
      toolCall: null,
      toolInput: null,
      outcome: "No tool call returned by model",
      status: "error",
      notes: text || undefined,
    });
    logNote(`  ⚠ Model did not call a tool. stop_reason=${response.stop_reason}`);
    return;
  }

  // Enforce one decision per application — take the first tool use.
  const block = toolBlocks[0];
  const input = asRecord(block.input);
  const result = executeTool(block.name, input);

  const score =
    typeof input.score === "number"
      ? input.score
      : typeof input.score === "string"
        ? Number(input.score)
        : null;
  const reason = typeof input.reason === "string" ? input.reason : null;

  logDecision({
    timestamp: new Date().toISOString(),
    applicationId: application.id,
    candidateName: application.name,
    score: Number.isFinite(score) ? score : null,
    reason,
    toolCall: result.tool,
    toolInput: input,
    outcome: result.outcome,
    status: result.status,
  });

  logNote(
    `  → tool=${result.tool} status=${result.status} score=${score ?? "?"} reason=${reason ?? "?"}`,
  );

  // Acknowledge tool result to Claude (good practice; not required for our offline log).
  if (toolBlocks.length > 1) {
    logNote(
      `  (ignored ${toolBlocks.length - 1} extra tool call(s); one decision per application)`,
    );
  }
}

async function main(): Promise<void> {
  const apiKey = requireApiKey();
  const client = new Anthropic({ apiKey });

  resetLog();
  logNote(`HRNext starting — model=${MODEL}`);
  logNote(`Decisions will be written to ${getLogPath()}`);

  for (const application of APPLICATIONS) {
    await reviewOne(client, application);
  }

  logNote(`\nDone. Logged ${APPLICATIONS.length} reviews → ${getLogPath()}`);
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
