/** Typed errors so Server Actions can show the right message to the user. */

export class MissingApiKeyError extends Error {
  constructor(public provider: string) {
    super(`Missing API key for ${provider}.`);
    this.name = "MissingApiKeyError";
  }
}

export class AiGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiGenerationError";
  }
}
