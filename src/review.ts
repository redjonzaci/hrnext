/**
 * HRNext — review job applications via Claude tool calling.
 *
 * Run: npm install && npm run review
 * Role: npm run review -- --role roles/backend-engineer.json
 * Requires ANTHROPIC_API_KEY in .env (see .env.example).
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { APPLICATIONS } from "./samples.js";
import { buildSystemPrompt, buildUserMessage } from "./prompt.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import { resetLog, logDecision, logNote, getLogPath } from "./logger.js";
import {
  loadRoleConfig,
  parseRolePath,
  type RoleConfig,
} from "./role.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
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
  role: RoleConfig,
  systemPrompt: string,
  application: (typeof APPLICATIONS)[number],
): Promise<void> {
  logNote(`\n── Reviewing application ${application.id} (${application.name}) ──`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools: TOOL_DEFINITIONS,
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: buildUserMessage(role.title, application.text),
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

  if (toolBlocks.length > 1) {
    logNote(
      `  (ignored ${toolBlocks.length - 1} extra tool call(s); one decision per application)`,
    );
  }
}

async function main(): Promise<void> {
  const rolePath = parseRolePath(process.argv);
  const role = loadRoleConfig(rolePath);
  const systemPrompt = buildSystemPrompt(role);

  const apiKey = requireApiKey();
  const client = new Anthropic({ apiKey });

  resetLog();
  logNote(`HRNext starting — model=${MODEL}`);
  logNote(`Role: ${role.title} (from ${rolePath})`);
  logNote(
    `Thresholds: advance≥${role.thresholds.advance}, request_more_info≥${role.thresholds.requestMoreInfo}, reject below that`,
  );
  logNote(`Decisions will be written to ${getLogPath()}`);

  for (const application of APPLICATIONS) {
    await reviewOne(client, role, systemPrompt, application);
  }

  logNote(`\nDone. Logged ${APPLICATIONS.length} reviews → ${getLogPath()}`);
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
