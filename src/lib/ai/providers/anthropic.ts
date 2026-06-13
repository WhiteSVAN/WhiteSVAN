/**
 * Anthropic/Claude report provider — opt-in via AI_PROVIDER=anthropic.
 * Built with the official @anthropic-ai/sdk per the project's Claude API guide.
 *
 * The strict system prompt instructs JSON-only output, which we validate with
 * Zod (`parseAiReport`). Structured outputs (`output_config.format`) could
 * tighten this further on Opus 4.8 / Haiku 4.5 if needed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt, type ReportInput } from "../prompt";
import { parseAiReport, type AiReport } from "../schema";
import { AiGenerationError, MissingApiKeyError } from "../errors";

export async function generateWithAnthropic(input: ReportInput): Promise<AiReport> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError("Anthropic");

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? process.env.AI_MODEL ?? "claude-opus-4-8";

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    if (message.stop_reason === "refusal") {
      throw new AiGenerationError("The model declined to generate this report.");
    }
    const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    return parseAiReport(text);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new MissingApiKeyError("Anthropic");
    if (err instanceof AiGenerationError || err instanceof MissingApiKeyError) throw err;
    throw new AiGenerationError("Anthropic report generation failed.", { cause: err });
  }
}
