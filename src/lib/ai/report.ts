/**
 * Provider-agnostic report generation. Both OpenAI and Claude implement the
 * same `(ReportInput) => AiReport` contract; `AI_PROVIDER` selects between them
 * (default: OpenAI).
 */
import { generateWithOpenAI } from "./providers/openai";
import { generateWithAnthropic } from "./providers/anthropic";
import type { ReportInput } from "./prompt";
import type { AiReport } from "./schema";

export type AiProviderName = "openai" | "anthropic";

export function activeProvider(): AiProviderName {
  return process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

export async function generateAiReport(input: ReportInput): Promise<AiReport> {
  return activeProvider() === "anthropic"
    ? generateWithAnthropic(input)
    : generateWithOpenAI(input);
}

export type { ReportInput } from "./prompt";
export type { AiReport } from "./schema";
