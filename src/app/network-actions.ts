"use server";

/**
 * Follow + private watchlist. Both are user-based (sign-in required); follow
 * counts are public, watchlists are visible only to their owner.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { optionalUserId } from "@/lib/auth/dal";
import { notify } from "@/lib/notify";

export type ToggleResult = { ok: true; on: boolean } | { ok: false; error: "signin" | "unavailable" | "self" };

async function publicProfile(profileId: string) {
  return prisma.traderProfile.findFirst({
    where: { id: profileId, isPublic: true },
    select: { id: true, userId: true, slug: true },
  });
}

export async function toggleFollow(profileId: string): Promise<ToggleResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: "signin" };
  const profile = await publicProfile(profileId);
  if (!profile) return { ok: false, error: "unavailable" };
  if (profile.userId === userId) return { ok: false, error: "self" };

  const key = { userId_profileId: { userId, profileId } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) {
    await prisma.follow.delete({ where: key });
  } else {
    await prisma.follow.create({ data: { userId, profileId } });
    const follower = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notify(profile.userId, "follow", `${follower?.name ?? "Someone"} followed your record`, "/analytics");
  }
  revalidatePath("/explore");
  revalidatePath(`/p/${profile.slug}`);
  return { ok: true, on: !existing };
}

export async function toggleWatchlist(profileId: string): Promise<ToggleResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: "signin" };
  const profile = await publicProfile(profileId);
  if (!profile) return { ok: false, error: "unavailable" };

  const key = { userId_profileId: { userId, profileId } };
  const existing = await prisma.watchlistItem.findUnique({ where: key });
  if (existing) await prisma.watchlistItem.delete({ where: key });
  else await prisma.watchlistItem.create({ data: { userId, profileId } });
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  return { ok: true, on: !existing };
}
