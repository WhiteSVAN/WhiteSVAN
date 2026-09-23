/**
 * Profile-view analytics. One row per (profile, viewer, UTC day): signed-in
 * viewers are keyed by user id, anonymous ones by a salted hash of their IP so
 * no raw IP is stored. Owners viewing their own profile are not counted.
 */
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export async function recordProfileView(profileId: string, ownerId: string, viewerId: string | null) {
  if (viewerId === ownerId) return;
  try {
    let viewerKey = viewerId ? `u:${viewerId}` : null;
    if (!viewerKey) {
      const h = await headers();
      const ua = h.get("user-agent") ?? "";
      if (/bot|crawl|spider|preview|slurp|facebookexternalhit/i.test(ua)) return;
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
      const salt = process.env.AUTH_SECRET ?? "trustsvan";
      viewerKey = `a:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`;
    }
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await prisma.profileView.upsert({
      where: { profileId_viewerKey_day: { profileId, viewerKey, day } },
      create: { profileId, viewerId, viewerKey, day },
      update: {},
    });
  } catch {
    // Analytics must never break the profile page.
  }
}
