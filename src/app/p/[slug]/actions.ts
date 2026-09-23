"use server";

import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIpKey } from "@/lib/request";

export type FollowState = { ok?: boolean; error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREQUENCIES = ["WEEKLY", "MONTHLY", "RISK_CHANGES_ONLY"] as const;
type Frequency = (typeof FREQUENCIES)[number];

/**
 * "Email updates" for a public profile (shown to signed-out visitors; signed-in
 * users follow instead). Stores a ProfileFollower so the trader's republishes
 * and risk changes can be emailed. Delivery + double opt-in are handled by the
 * notification queue — this only captures the subscription.
 */
export async function followProfile(_prev: FollowState, formData: FormData): Promise<FollowState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const freqRaw = String(formData.get("frequency") ?? "MONTHLY");
  const frequency: Frequency = (FREQUENCIES as readonly string[]).includes(freqRaw)
    ? (freqRaw as Frequency)
    : "MONTHLY";

  if (email.length > 254 || !EMAIL.test(email)) return { error: "Enter a valid email address." };
  const limited = checkRateLimit(await requestIpKey("profile-follow"), {
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return { error: `Too many follow attempts. Try again in ${limited.retryAfterSeconds} seconds.` };
  }

  const profile = await prisma.traderProfile.findUnique({
    where: { slug },
    select: { id: true, isPublic: true },
  });
  if (!profile || !profile.isPublic) return { error: "This profile isn't available." };

  await prisma.profileFollower.upsert({
    where: { profileId_email: { profileId: profile.id, email } },
    update: { frequency, status: "ACTIVE" },
    create: { profileId: profile.id, email, frequency, status: "ACTIVE" },
  });

  return { ok: true };
}
