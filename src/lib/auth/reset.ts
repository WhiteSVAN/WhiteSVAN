/**
 * Password-reset tokens.
 *
 * Reuses the Auth.js `VerificationToken` table (identifier + token + expires) so
 * no schema change is needed — this app uses credentials only, so that table is
 * otherwise unused. One active token per email; tokens are single-use and expire
 * after one hour.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Issue a fresh single-use reset token for `email`, invalidating any prior one. */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TTL_MS);
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });
  return token;
}

/**
 * Validate and consume a reset token. Returns the email it was issued for, or
 * null if the token is unknown or expired. Always deletes the token (single-use).
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  if (!token) return null;
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;
  await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
  if (row.expires.getTime() < Date.now()) return null;
  return row.identifier;
}
