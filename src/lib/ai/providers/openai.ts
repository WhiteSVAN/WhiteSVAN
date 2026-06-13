/** OpenAI report provider — the default. JSON mode + Zod validation. */
import OpenAI from "openai";
import { SYSTEM_PROMPT, buildUserPrompt, type ReportInput } from "../prompt";
import { parseAiReport, type AiReport } from "../schema";
import { AiGenerationError, MissingApiKeyError } from "../errors";

export async function generateWithOpenAI(input: ReportInput): Promise<AiReport> {
  if (!process.env.OPENAI_API_KEY) throw new MissingApiKeyError("OpenAI");

  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });
    return parseAiReport(completion.choices[0]?.message?.content ?? "");
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) throw new MissingApiKeyError("OpenAI");
    if (err instanceof MissingApiKeyError) throw err;
    throw new AiGenerationError("OpenAI report generation failed.", { cause: err });
  }
}
