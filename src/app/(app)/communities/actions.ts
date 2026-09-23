"use server";

/**
 * Community membership: create, join/request, cancel, leave, accept invite.
 * Every action re-reads the session and the caller's membership on the server;
 * ids arriving in FormData are only identifiers.
 */
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import {
  COMMUNITY_LIMITS,
  canLeave,
  communityCopyError,
  communitySlugError,
  inviteIsUsable,
  isCommunityVisibility,
  joinOutcome,
  slugifyCommunity,
  type CommunityActionResult,
} from "@/lib/communities";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function tooOften(key: string, limit: number, windowMs: number): string | null {
  const r = checkRateLimit(key, { limit, windowMs });
  return r.ok ? null : `You're doing that too often. Try again in ${Math.max(1, Math.ceil(r.retryAfterSeconds / 60))} min.`;
}

export type CreateCommunityState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;

export async function createCommunity(_prev: CreateCommunityState, formData: FormData): Promise<CreateCommunityState> {
  const user = await requireOnboardedUser();
  const values = {
    name: str(formData, "name"),
    slug: str(formData, "slug"),
    description: str(formData, "description"),
    rules: str(formData, "rules"),
    visibility: str(formData, "visibility"),
    requireApproval: formData.get("requireApproval") === "on" ? "on" : "",
  };
  const fieldErrors: Record<string, string> = {};

  if (values.name.length < COMMUNITY_LIMITS.nameMin || values.name.length > COMMUNITY_LIMITS.nameMax) {
    fieldErrors.name = `Use ${COMMUNITY_LIMITS.nameMin}–${COMMUNITY_LIMITS.nameMax} characters.`;
  }
  const slug = slugifyCommunity(values.slug || values.name);
  const slugError = communitySlugError(slug);
  if (slugError) fieldErrors.slug = slugError;
  if (values.description.length > COMMUNITY_LIMITS.description) {
    fieldErrors.description = `Keep the description under ${COMMUNITY_LIMITS.description} characters.`;
  }
  if (values.rules.length > COMMUNITY_LIMITS.rules) {
    fieldErrors.rules = `Keep the rules under ${COMMUNITY_LIMITS.rules} characters.`;
  }
  if (!isCommunityVisibility(values.visibility)) fieldErrors.visibility = "Choose public or private.";
  if (Object.keys(fieldErrors).length > 0) return { error: "Fix the highlighted fields.", fieldErrors, values };

  const copyError = communityCopyError([values.name, values.description, values.rules]);
  if (copyError) return { error: copyError, values };

  const limited = tooOften(`community:create:${user.id}`, 3, 60 * 60_000);
  if (limited) return { error: limited, values };

  const taken = await prisma.community.findUnique({ where: { slug }, select: { id: true } });
  if (taken) return { error: "That link is taken. Choose another.", fieldErrors: { slug: "That link is taken." }, values };

  try {
    await prisma.community.create({
      data: {
        slug,
        name: values.name,
        description: values.description || null,
        rules: values.rules || null,
        visibility: values.visibility as "PUBLIC" | "PRIVATE",
        requireApproval: values.requireApproval === "on",
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } },
      },
      select: { id: true },
    });
  } catch {
    // Unique-slug race with a concurrent create.
    return { error: "That link is taken. Choose another.", fieldErrors: { slug: "That link is taken." }, values };
  }
  redirect(`/communities/${slug}`);
}

/** Owners/admins of a community (for join-request notifications). */
async function moderatorIds(communityId: string): Promise<string[]> {
  const rows = await prisma.communityMember.findMany({
    where: { communityId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Join a public open community, or send a join request (approval required / private). */
export async function joinCommunity(formData: FormData): Promise<CommunityActionResult> {
  const user = await requireOnboardedUser();
  const community = await prisma.community.findUnique({
    where: { id: str(formData, "communityId") },
    select: { id: true, slug: true, name: true, visibility: true, requireApproval: true },
  });
  if (!community) return { ok: false, error: "That community no longer exists." };

  const key = { communityId_userId: { communityId: community.id, userId: user.id } };
  const existing = await prisma.communityMember.findUnique({ where: key, select: { status: true } });
  const outcome = joinOutcome(community.visibility, community.requireApproval, false, existing?.status ?? null);

  if (outcome === "DENIED") {
    return { ok: false, error: "You were removed from this community. An admin can send you an invite link." };
  }
  if (outcome === "UNCHANGED") {
    return { ok: true, message: existing?.status === "PENDING" ? "Your request is already pending." : "You're already a member." };
  }

  const limited = tooOften(`community:join:${user.id}`, 20, 60 * 60_000);
  if (limited) return { ok: false, error: limited };

  await prisma.communityMember.upsert({
    where: key,
    create: { communityId: community.id, userId: user.id, role: "MEMBER", status: outcome },
    update: { status: outcome },
  });

  if (outcome === "PENDING") {
    const who = user.profile?.displayName || user.name || "Someone";
    for (const id of await moderatorIds(community.id)) {
      await notify(id, "community_request", `${who} asked to join ${community.name}`, `/communities/${community.slug}/admin`);
    }
    refresh();
    return { ok: true, message: "Request sent. An admin will review it." };
  }
  refresh();
  return { ok: true, message: "You joined." };
}

/** Withdraw a pending join request. */
export async function cancelJoinRequest(formData: FormData): Promise<CommunityActionResult> {
  const user = await requireOnboardedUser();
  const communityId = str(formData, "communityId");
  const { count } = await prisma.communityMember.deleteMany({
    where: { communityId, userId: user.id, status: "PENDING" },
  });
  refresh();
  return count > 0 ? { ok: true, message: "Request withdrawn." } : { ok: false, error: "No pending request to withdraw." };
}

/** Leave a community. The owner can't leave; removed members have nothing to leave. */
export async function leaveCommunity(formData: FormData): Promise<CommunityActionResult> {
  const user = await requireOnboardedUser();
  const communityId = str(formData, "communityId");
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
    select: { id: true, role: true, status: true },
  });
  if (!membership || !canLeave(membership)) {
    return {
      ok: false,
      error: membership?.role === "OWNER" ? "The owner can't leave their own community." : "You're not a member.",
    };
  }
  await prisma.communityMember.delete({ where: { id: membership.id } });
  refresh();
  return { ok: true, message: "You left the community." };
}

/** Accept an invite link: becomes ACTIVE (bypasses approval, re-activates removed members). */
export async function acceptInvite(formData: FormData): Promise<CommunityActionResult> {
  const user = await requireOnboardedUser();
  const token = str(formData, "token");
  const invite = token
    ? await prisma.communityInvite.findUnique({
        where: { token },
        select: {
          id: true,
          expiresAt: true,
          community: { select: { id: true, slug: true, visibility: true, requireApproval: true } },
        },
      })
    : null;
  if (!invite || !inviteIsUsable(invite)) return { ok: false, error: "This invite link has expired or was revoked." };

  const limited = tooOften(`community:invite:${user.id}`, 20, 60 * 60_000);
  if (limited) return { ok: false, error: limited };

  const { community } = invite;
  const key = { communityId_userId: { communityId: community.id, userId: user.id } };
  const existing = await prisma.communityMember.findUnique({ where: key, select: { status: true } });
  const outcome = joinOutcome(community.visibility, community.requireApproval, true, existing?.status ?? null);

  if (outcome === "ACTIVE") {
    await prisma.$transaction([
      prisma.communityMember.upsert({
        where: key,
        create: { communityId: community.id, userId: user.id, role: "MEMBER", status: "ACTIVE" },
        update: { status: "ACTIVE" },
      }),
      prisma.communityInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
    ]);
  }
  redirect(`/communities/${community.slug}`);
}
