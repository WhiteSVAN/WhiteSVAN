"use server";

/**
 * Follow + private watchlist. Both are user-based (sign-in required); follow
 * counts are public, watchlists are visible only to their owner.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { optionalUserId } from "@/lib/auth/dal";
import { notify } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";

export type ToggleResult =
  | { ok: true; on: boolean }
  | { ok: false; error: "signin" | "unavailable" | "self" | "rate" };

const TOGGLE_LIMIT = { limit: 60, windowMs: 60_000 };
/** One "followed you" notification per follower/profile pair per day, however often they toggle. */
const FOLLOW_NOTIFY_LIMIT = { limit: 1, windowMs: 24 * 60 * 60_000 };

function validId(profileId: unknown): profileId is string {
  return typeof profileId === "string" && profileId.length > 0 && profileId.length <= 64;
}

async function publicProfile(profileId: string) {
  return prisma.traderProfile.findFirst({
    where: { id: profileId, isPublic: true },
    select: { id: true, userId: true, slug: true },
  });
}

export async function toggleFollow(profileId: string): Promise<ToggleResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: "signin" };
  if (!validId(profileId)) return { ok: false, error: "unavailable" };
  if (!checkRateLimit(`network-toggle:${userId}`, TOGGLE_LIMIT).ok) return { ok: false, error: "rate" };
  const profile = await publicProfile(profileId);
  if (!profile) {
    // A profile that went private can still be unfollowed (only the caller's own row is touched).
    const removed = await prisma.follow.deleteMany({ where: { userId, profileId } });
    return removed.count > 0 ? { ok: true, on: false } : { ok: false, error: "unavailable" };
  }
  if (profile.userId === userId) return { ok: false, error: "self" };

  // deleteMany/createMany(skipDuplicates) keep a double-click from throwing on the composite key.
  const removed = await prisma.follow.deleteMany({ where: { userId, profileId: profile.id } });
  const on = removed.count === 0;
  if (on) {
    await prisma.follow.createMany({ data: [{ userId, profileId: profile.id }], skipDuplicates: true });
    if (checkRateLimit(`follow-notify:${userId}:${profile.id}`, FOLLOW_NOTIFY_LIMIT).ok) {
      const follower = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await notify(profile.userId, "follow", `${follower?.name ?? "Someone"} followed your record`, "/analytics");
    }
  }
  revalidatePath("/explore");
  revalidatePath("/feed");
  revalidatePath(`/p/${profile.slug}`);
  return { ok: true, on };
}

export async function toggleWatchlist(profileId: string): Promise<ToggleResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: "signin" };
  if (!validId(profileId)) return { ok: false, error: "unavailable" };
  if (!checkRateLimit(`network-toggle:${userId}`, TOGGLE_LIMIT).ok) return { ok: false, error: "rate" };
  const profile = await publicProfile(profileId);
  if (!profile) {
    // A profile that went private can still be removed from the caller's own watchlist.
    const removed = await prisma.watchlistItem.deleteMany({ where: { userId, profileId } });
    if (removed.count > 0) revalidatePath("/dashboard");
    return removed.count > 0 ? { ok: true, on: false } : { ok: false, error: "unavailable" };
  }

  const removed = await prisma.watchlistItem.deleteMany({ where: { userId, profileId: profile.id } });
  const on = removed.count === 0;
  if (on) {
    await prisma.watchlistItem.createMany({ data: [{ userId, profileId: profile.id }], skipDuplicates: true });
  }
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  revalidatePath(`/p/${profile.slug}`);
  return { ok: true, on };
}
