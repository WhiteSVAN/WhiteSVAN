"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import {
  loginSchema,
  signupSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { createPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export type AuthFormState =
  | {
      errors?: { name?: string[]; email?: string[]; password?: string[]; role?: string[] };
      message?: string;
      sent?: boolean;
    }
  | undefined;

/** Verify credentials and start a session, then redirect to the dashboard. */
export async function authenticate(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
    return undefined;
  } catch (error) {
    // `signIn` throws a redirect on success — let it propagate.
    if (error instanceof AuthError) {
      logger.warn("auth.signin.failed", { email: parsed.data.email });
      return { message: "Invalid email or password." };
    }
    throw error;
  }
}

/** Create an account, then sign the new user in and send them to onboarding. */
export async function signup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    logger.warn("auth.signup.duplicate", { email });
    return { errors: { email: ["An account with this email already exists."] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const referredById = await referrerIdFor(String(formData.get("ref") ?? ""));
  const created = await prisma.user.create({
    data: { name, email, passwordHash, role, referredById },
    select: { id: true },
  });
  logger.info("auth.signup.created", { userId: created.id, email, role });

  try {
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) return { message: "Account created — please sign in." };
    throw error;
  }
}

/** Resolve a referral code to the referring user's id (null when unknown). */
async function referrerIdFor(code: string): Promise<string | null> {
  const clean = code.trim().toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(clean)) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: clean }, select: { id: true } });
  return referrer?.id ?? null;
}

/**
 * Start a Google sign-in. The chosen role and referral code ride along in
 * short-lived cookies; onboarding applies them to a new account (Google users
 * without a role are asked for one there).
 */
export async function signInWithGoogle(formData: FormData) {
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 30 };
  const role = String(formData.get("role") ?? "");
  const ref = String(formData.get("ref") ?? "");
  if (role === "TRADER" || role === "CLIENT") store.set("signup_role", role, opts);
  if (ref) store.set("signup_ref", ref.slice(0, 16), opts);
  await signIn("google", { redirectTo: "/onboarding" });
}

/**
 * Forgot password: email a single-use reset link. Always returns the same
 * neutral result whether or not the email matches an account, so this can't be
 * used to discover which emails are registered. When no email provider is wired,
 * the link is logged to the server console (see src/lib/email.ts).
 */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const token = await createPasswordResetToken(email);
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    await sendPasswordResetEmail(email, `${proto}://${host}/reset?token=${token}`);
  }
  return { sent: true };
}

/** Reset password using a token from the emailed link, then send the user to sign in. */
export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const email = await consumePasswordResetToken(token);
  if (!email) {
    return { message: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const updated = await prisma.user
    .update({ where: { email }, data: { passwordHash } })
    .catch(() => null);
  if (!updated) return { message: "Could not reset the password for that account." };

  redirect("/login?reset=1");
}
