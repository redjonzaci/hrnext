import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RubricCriterion = {
  name: string;
  weight: number;
  guidance: string;
};

export type RoleThresholds = {
  /** Score >= this → prefer advance_to_interview */
  advance: number;
  /** Score >= this and < advance → prefer request_more_info; below → prefer reject */
  requestMoreInfo: number;
};

export type RoleConfig = {
  title: string;
  rubric: RubricCriterion[];
  thresholds: RoleThresholds;
};

export const DEFAULT_ROLE_PATH = "roles/customer-support-specialist.json";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRoleConfig(value: unknown, path: string): RoleConfig {
  if (!isObject(value)) {
    throw new Error(`Role config at ${path} must be a JSON object`);
  }

  const title = value.title;
  if (typeof title !== "string" || !title.trim()) {
    throw new Error(`Role config ${path}: "title" must be a non-empty string`);
  }

  if (!Array.isArray(value.rubric) || value.rubric.length === 0) {
    throw new Error(`Role config ${path}: "rubric" must be a non-empty array`);
  }

  const rubric: RubricCriterion[] = value.rubric.map((item, i) => {
    if (!isObject(item)) {
      throw new Error(`Role config ${path}: rubric[${i}] must be an object`);
    }
    const name = item.name;
    const weight = item.weight;
    const guidance = item.guidance;
    if (typeof name !== "string" || !name.trim()) {
      throw new Error(`Role config ${path}: rubric[${i}].name must be a string`);
    }
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(
        `Role config ${path}: rubric[${i}].weight must be a positive number`,
      );
    }
    if (typeof guidance !== "string" || !guidance.trim()) {
      throw new Error(
        `Role config ${path}: rubric[${i}].guidance must be a string`,
      );
    }
    return { name, weight, guidance };
  });

  if (!isObject(value.thresholds)) {
    throw new Error(`Role config ${path}: "thresholds" must be an object`);
  }
  const advance = value.thresholds.advance;
  const requestMoreInfo = value.thresholds.requestMoreInfo;
  if (typeof advance !== "number" || advance < 0 || advance > 100) {
    throw new Error(
      `Role config ${path}: thresholds.advance must be a number 0–100`,
    );
  }
  if (
    typeof requestMoreInfo !== "number" ||
    requestMoreInfo < 0 ||
    requestMoreInfo > 100
  ) {
    throw new Error(
      `Role config ${path}: thresholds.requestMoreInfo must be a number 0–100`,
    );
  }
  if (requestMoreInfo >= advance) {
    throw new Error(
      `Role config ${path}: thresholds.requestMoreInfo must be < thresholds.advance`,
    );
  }

  const weightSum = rubric.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(weightSum - 100) > 0.001) {
    console.warn(
      `Warning: role "${title}" rubric weights sum to ${weightSum} (expected 100). Scores still use 0–100.`,
    );
  }

  return {
    title: title.trim(),
    rubric,
    thresholds: { advance, requestMoreInfo },
  };
}

/** Load role config from a JSON file path (never from application text). */
export function loadRoleConfig(rolePath: string): RoleConfig {
  const absolute = resolve(process.cwd(), rolePath);
  let raw: string;
  try {
    raw = readFileSync(absolute, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read role config at ${rolePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid JSON in role config ${rolePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return assertRoleConfig(parsed, rolePath);
}

/** Parse `--role <path>` from argv; default to Customer Support Specialist. */
export function parseRolePath(argv: string[]): string {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--role") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Usage: npm run review -- --role roles/<file>.json");
      }
      return next;
    }
    if (arg.startsWith("--role=")) {
      const value = arg.slice("--role=".length);
      if (!value) {
        throw new Error("Usage: npm run review -- --role roles/<file>.json");
      }
      return value;
    }
  }
  return DEFAULT_ROLE_PATH;
}
