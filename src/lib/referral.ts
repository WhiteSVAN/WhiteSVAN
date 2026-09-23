/**
 * Trader referral codes: 8 characters of [a-z0-9], unique per user, used in
 * `/signup?ref=CODE`. Pure helpers (no DB) — the invite page wires them to Prisma.
 */

export const REFERRAL_CODE_LENGTH = 8;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** Largest multiple of 36 below 256 — bytes at or above it are rejected to avoid modulo bias. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

export type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/** A fresh random referral code, e.g. `k3v9x0qa`. */
export function generateReferralCode(randomBytes: RandomBytes = cryptoBytes): string {
  let code = "";
  while (code.length < REFERRAL_CODE_LENGTH) {
    for (const byte of randomBytes(REFERRAL_CODE_LENGTH * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === REFERRAL_CODE_LENGTH) break;
    }
  }
  return code;
}

/** True for a well-formed code as generated here (exactly 8 × [a-z0-9]). */
export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{8}$/.test(value);
}

/** Untrusted `?ref=` input → a lowercase, trimmed code, or null when malformed. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return isReferralCode(code) ? code : null;
}

export class ReferralCodeExhaustedError extends Error {
  constructor(attempts: number) {
    super(`Could not allocate a unique referral code after ${attempts} attempts.`);
    this.name = "ReferralCodeExhaustedError";
  }
}

/**
 * Allocate a unique code by retrying on collision. `attempt(code)` tries to
 * persist the code and returns `true` on success or `false` when it collided
 * with an existing one (any other failure should throw).
 */
export async function allocateReferralCode(
  attempt: (code: string) => Promise<boolean>,
  opts: { maxAttempts?: number; generate?: () => string } = {},
): Promise<string> {
  const maxAttempts = opts.maxAttempts ?? 6;
  const generate = opts.generate ?? (() => generateReferralCode());
  for (let i = 0; i < maxAttempts; i++) {
    const code = generate();
    if (await attempt(code)) return code;
  }
  throw new ReferralCodeExhaustedError(maxAttempts);
}

/** `https://host/signup?ref=CODE` */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/signup?ref=${encodeURIComponent(code)}`;
}
