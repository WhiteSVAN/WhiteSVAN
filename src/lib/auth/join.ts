/**
 * Creating an account where it's needed: at checkout, on the same screen as choosing a size and
 * paying, so a new trader never visits a separate sign-up page. An email that already has an
 * account signs in with its password instead. Server only: Prisma, bcrypt and the session cookie.
 */
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { passwordField } from "@/lib/auth/schemas";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type JoinField = "email" | "password";

export type JoinResult =
  | { joined: true; userId: string; email: string; created: boolean }
  | { joined: false; errors?: Partial<Record<JoinField, string[]>>; message?: string };

const credentials = z.object({
  email: z.email({ error: "Enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Enter a password." }),
});

/** Resolve a referral code to the referring user's id (null when unknown). */
export async function referrerIdFor(code: string): Promise<string | null> {
  const clean = code.trim().toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(clean)) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: clean }, select: { id: true } });
  return referrer?.id ?? null;
}

/**
 * Sign in with an email and password, creating the trader's account first when the email is new.
 * The session cookie is set on this response; callers use the returned id, since the request
 * itself still has no session.
 */
export async function joinWithPassword(input: { email: unknown; password: unknown; referral?: string }): Promise<JoinResult> {
  const parsed = credentials.safeParse({ email: input.email, password: input.password });
  if (!parsed.success) return { joined: false, errors: parsed.error.flatten().fieldErrors };
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, role: true } });
  if (existing && !existing.passwordHash) return { joined: false, errors: { email: ["This email signs in with Google: use Continue with Google."] } };

  let userId = existing?.id;
  if (!userId) {
    const strength = passwordField.safeParse(password);
    if (!strength.success) return { joined: false, errors: { password: strength.error.flatten().formErrors } };
    try {
      const created = await prisma.user.create({
        data: { email, passwordHash: await bcrypt.hash(password, 10), role: "TRADER", referredById: await referrerIdFor(input.referral ?? "") },
        select: { id: true },
      });
      userId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { joined: false, errors: { email: ["An account with this email was just created. Log in to continue."] } };
      }
      throw error;
    }
    logger.info("auth.signup.created", { userId, email, role: "TRADER", via: "checkout" });
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    logger.warn("auth.signin.failed", { email, via: "checkout" });
    return existing
      ? { joined: false, errors: { password: ["That isn't the password for this email. Log in, or reset your password."] } }
      : { joined: false, message: "Your account is ready. Log in to check out." };
  }
  // An account from before roles were set up trades like every other.
  if (existing && !existing.role) await prisma.user.updateMany({ where: { id: userId, role: null }, data: { role: "TRADER" } });
  return { joined: true, userId, email, created: !existing };
}
