import type { AiReport } from "@/lib/ai/schema";

export interface TextRedactionOptions {
  hideAmounts?: boolean;
  terms?: string[];
}

const MONEY_PATTERN = /-?\$\s?\d[\d,]*(?:\.\d+)?/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(text: string, options: TextRedactionOptions): string {
  let redacted = text;
  if (options.hideAmounts) {
    redacted = redacted.replace(MONEY_PATTERN, "Private amount");
  }

  const terms = [...new Set((options.terms ?? []).map((t) => t.trim()).filter((t) => t.length >= 2))]
    .sort((a, b) => b.length - a.length);
  for (const term of terms) {
    redacted = redacted.replace(new RegExp(escapeRegExp(term), "gi"), "Private label");
  }
  return redacted;
}

export function redactReport(report: AiReport, options: TextRedactionOptions): AiReport {
  return {
    executive_summary: redactText(report.executive_summary, options),
    performance_summary: redactText(report.performance_summary, options),
    risk_summary: redactText(report.risk_summary, options),
    discipline_review: redactText(report.discipline_review, options),
    notable_days: report.notable_days.map((item) => redactText(item, options)),
    warnings: report.warnings.map((item) => redactText(item, options)),
    client_disclaimer: redactText(report.client_disclaimer, options),
  };
}
