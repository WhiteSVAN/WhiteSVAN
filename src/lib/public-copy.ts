import { findBannedPhrases } from "@/lib/ai/compliance";

export function publicCopyIssues(values: Array<string | null | undefined>): string[] {
  return [...new Set(findBannedPhrases(values.filter(Boolean).join("\n")))];
}

export function publicCopyError(issues: string[]): string | null {
  if (issues.length === 0) return null;
  return `Remove compliance-sensitive language before publishing this public text: ${issues.join(", ")}.`;
}
