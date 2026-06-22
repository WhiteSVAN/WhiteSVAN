/**
 * Zod schemas shared by auth Server Actions and forms.
 * Keeping them in one place lets the client form and server validation agree.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
});

/** Shared password strength rule for signup and password reset. */
const passwordField = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." });

export const signupSchema = z.object({
  name: z.string().min(2, { error: "Name must be at least 2 characters." }).trim(),
  email: z.email({ error: "Enter a valid email." }).trim(),
  password: passwordField,
});

/** Forgot-password: just an email to send the reset link to. */
export const requestResetSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim(),
});

/** Reset-password: the new password (token is validated separately). */
export const resetPasswordSchema = z.object({
  password: passwordField,
});

/** Public portal handle: lowercase letters, numbers and dashes (3–30 chars). */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: "Handle must be at least 3 characters." })
  .max(30, { error: "Handle must be at most 30 characters." })
  .regex(/^[a-z0-9-]+$/, { error: "Use lowercase letters, numbers and dashes only." });

export const profileSchema = z.object({
  displayName: z.string().min(2, { error: "Display name is required." }).trim(),
  slug: slugSchema,
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  strategy: z.string().trim().max(500).optional().or(z.literal("")),
  instruments: z.string().trim().max(200).optional().or(z.literal("")),
  riskRules: z.string().trim().max(500).optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
