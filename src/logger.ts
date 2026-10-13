import { appendFileSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type DecisionRecord = {
  timestamp: string;
  applicationId: string;
  candidateName: string;
  score: number | null;
  reason: string | null;
  toolCall: string | null;
  toolInput: Record<string, unknown> | null;
  outcome: string | null;
  status: string | null;
  notes?: string;
};

const LOG_PATH = resolve(process.cwd(), "decisions.json");

function loadExisting(): DecisionRecord[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const raw = readFileSync(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DecisionRecord[]) : [];
  } catch {
    return [];
  }
}

let records: DecisionRecord[] = loadExisting();

export function resetLog(): void {
  records = [];
  writeFileSync(LOG_PATH, "[]\n", "utf8");
}

export function logDecision(record: DecisionRecord): void {
  records.push(record);
  writeFileSync(LOG_PATH, JSON.stringify(records, null, 2) + "\n", "utf8");

  const line = [
    `[${record.timestamp}]`,
    `app=${record.applicationId}`,
    `candidate=${record.candidateName}`,
    record.score !== null ? `score=${record.score}` : null,
    record.reason ? `reason="${record.reason}"` : null,
    record.toolCall ? `tool=${record.toolCall}` : null,
    record.status ? `status=${record.status}` : null,
    record.outcome ? `outcome=${record.outcome}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(line);
}

/** Append a free-form console+file note (e.g. agent message snippets). */
export function logNote(message: string): void {
  console.log(message);
  appendFileSync(resolve(process.cwd(), "review.log"), message + "\n", "utf8");
}

export function getLogPath(): string {
  return LOG_PATH;
}
