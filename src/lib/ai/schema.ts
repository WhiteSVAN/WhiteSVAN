/**
 * The AI report shape (plan §6). Code computes the numbers; the model only
 * writes these prose/list fields. Validated with Zod after generation so a
 * malformed model response is rejected before it ever reaches the database.
 */
import { z } from "zod";

export const aiReportSchema = z.object({
  executive_summary: z.string(),
  performance_summary: z.string(),
  risk_summary: z.string(),
  discipline_review: z.string(),
  notable_days: z.array(z.string()),
  warnings: z.array(z.string()),
  client_disclaimer: z.string(),
});

export type AiReport = z.infer<typeof aiReportSchema>;

/** Parse a model response into a validated report, tolerating prose/code fences
 *  around the JSON object. Throws on invalid JSON or schema mismatch. */
export function parseAiReport(text: string): AiReport {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  return aiReportSchema.parse(JSON.parse(json));
}

/** JSON Schema mirror for providers that support structured output (Anthropic). */
export const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executive_summary: { type: "string" },
    performance_summary: { type: "string" },
    risk_summary: { type: "string" },
    discipline_review: { type: "string" },
    notable_days: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    client_disclaimer: { type: "string" },
  },
  required: [
    "executive_summary",
    "performance_summary",
    "risk_summary",
    "discipline_review",
    "notable_days",
    "warnings",
    "client_disclaimer",
  ],
} as const;
