"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";
import { logger } from "@/lib/logger";

export type AuthFormState =
  | {
      errors?: { name?: string[]; email?: string[]; password?: string[] };
      message?: string;
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
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    logger.warn("auth.signup.duplicate", { email });
    return { errors: { email: ["An account with this email already exists."] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true },
  });
  logger.info("auth.signup.created", { userId: created.id, email });

  try {
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) return { message: "Account created — please sign in." };
    throw error;
  }
}
