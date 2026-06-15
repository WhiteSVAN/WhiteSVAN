import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest of a UTF-8 string. Used to fingerprint imported files so an
 * import is verifiable and re-imports are recognizable. Server-only (node:crypto).
 */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
