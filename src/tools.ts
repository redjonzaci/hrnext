import type Anthropic from "@anthropic-ai/sdk";

export const TOOL_NAMES = [
  "advance_to_interview",
  "reject",
  "request_more_info",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolResult = {
  tool: ToolName;
  input: Record<string, unknown>;
  /** Human-facing outcome after policy enforcement */
  outcome: string;
  /** Persistable status — reject is never applied immediately */
  status: "advanced" | "waiting_for_human_approval" | "info_requested";
};

/** Claude tool definitions (real function calling; strict for Sonnet 5.5). */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "advance_to_interview",
    description:
      "Advance the candidate to the interview stage. Use when the score and fit justify progressing.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Overall score from 0 to 100 according to the rubric.",
        },
        reason: {
          type: "string",
          description: "One-line reason for the decision.",
        },
      },
      required: ["score", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "reject",
    description:
      "Propose rejecting the candidate. This does NOT reject immediately — it queues for human approval.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Overall score from 0 to 100 according to the rubric.",
        },
        reason: {
          type: "string",
          description: "One-line reason for proposing rejection.",
        },
      },
      required: ["score", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "request_more_info",
    description:
      "Ask the candidate for more information before deciding. Use when the application is incomplete or ambiguous.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Provisional score from 0 to 100 based on what is known.",
        },
        reason: {
          type: "string",
          description: "One-line reason and what info is still needed.",
        },
        questions: {
          type: "array",
          items: { type: "string" },
          description: "Specific questions to ask the candidate.",
        },
      },
      required: ["score", "reason", "questions"],
      additionalProperties: false,
    },
  },
];

/**
 * Execute a tool call locally. Rejection is never applied directly —
 * it is saved as waiting_for_human_approval.
 */
export function executeTool(
  name: string,
  input: Record<string, unknown>,
): ToolResult {
  if (!TOOL_NAMES.includes(name as ToolName)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const tool = name as ToolName;

  switch (tool) {
    case "advance_to_interview":
      return {
        tool,
        input,
        outcome: "Candidate advanced to interview",
        status: "advanced",
      };
    case "reject":
      return {
        tool,
        input,
        outcome:
          "Rejection proposed — saved as waiting_for_human_approval (agent cannot reject alone)",
        status: "waiting_for_human_approval",
      };
    case "request_more_info":
      return {
        tool,
        input,
        outcome: "More information requested from candidate",
        status: "info_requested",
      };
  }
}
