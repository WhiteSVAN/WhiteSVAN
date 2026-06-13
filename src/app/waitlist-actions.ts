"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({ email: z.email({ error: "Enter a valid email." }).trim() });

export type WaitlistState = { ok?: boolean; error?: string } | undefined;

/** Capture a beta-waitlist email. Idempotent on email. */
export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }
  try {
    await prisma.waitlistEntry.upsert({
      where: { email: parsed.data.email },
      create: { email: parsed.data.email },
      update: {},
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
