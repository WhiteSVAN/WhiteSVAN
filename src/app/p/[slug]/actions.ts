"use server";

import { prisma } from "@/lib/db";

export type FollowState = { ok?: boolean; error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREQUENCIES = ["WEEKLY", "MONTHLY", "RISK_CHANGES_ONLY"] as const;
type Frequency = (typeof FREQUENCIES)[number];

/**
 * Follow a public profile by email (MVP2.5). Stores a follower record so the
 * trader can notify subscribers of updates/risk changes. Email delivery +
 * double opt-in are stubbed for now — this only captures the subscription.
 */
export async function followProfile(_prev: FollowState, formData: FormData): Promise<FollowState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const freqRaw = String(formData.get("frequency") ?? "MONTHLY");
  const frequency: Frequency = (FREQUENCIES as readonly string[]).includes(freqRaw)
    ? (freqRaw as Frequency)
    : "MONTHLY";

  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };

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
