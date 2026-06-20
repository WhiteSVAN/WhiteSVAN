"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIpKey } from "@/lib/request";

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

  const limited = checkRateLimit(await requestIpKey("waitlist"), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return { error: `Too many submissions. Try again in ${limited.retryAfterSeconds} seconds.` };
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
