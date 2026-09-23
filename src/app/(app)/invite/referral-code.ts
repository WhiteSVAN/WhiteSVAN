/**
 * Server helpers for the trader invite page. Callers must have authorized the
 * user already (requireTrader()); these only touch the caller's own row.
 */
import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { allocateReferralCode } from "@/lib/referral";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The user's referral code, created on first use. Retries on the (rare)
 * collision with another user's code; a concurrent request that already set a
 * code wins, because we only write while the column is still null.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (existing?.referralCode) return existing.referralCode;

  await allocateReferralCode(async (code) => {
    try {
      await prisma.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: code },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  });

  const after = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!after?.referralCode) throw new Error("Referral code was not saved.");
  return after.referralCode;
}

/** Public origin for share links: configured app URL first, then the request host. */
export async function requestOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured && /^https?:\/\//i.test(configured)) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to the request host
    }
  }
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}
