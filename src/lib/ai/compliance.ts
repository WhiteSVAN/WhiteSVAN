/**
 * Banned-language filter (plan §13). Load-bearing guardrail: a report with any
 * of these phrases must not be published. Pure and dependency-free so it runs
 * on the server (authoritative check) and the client (live editor feedback).
 */
import type { AiReport } from "./schema";

/** Phrases that imply advice, guarantees, or solicitation. */
export const BANNED_PHRASES = [
  "guaranteed returns",
  "guaranteed",
  "risk-free",
  "safe investment",
  "you should invest",
  "allocate",
  "copy my trade",
  "will make money",
  "assured profits",
] as const;

/** Banned phrases present in a single text blob (case-insensitive). */
export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

/** Unique banned phrases across every field of a report. */
export function reportComplianceIssues(report: AiReport): string[] {
  const text = [
    report.executive_summary,
    report.performance_summary,
    report.risk_summary,
    report.discipline_review,
    report.client_disclaimer,
    ...report.notable_days,
    ...report.warnings,
  ].join("\n");
  return [...new Set(findBannedPhrases(text))];
}
