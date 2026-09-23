"use server";

/**
 * Community moderation. Each action re-reads the caller's membership from the
 * database and applies the pure rules in src/lib/communities.ts — the owner is
 * never removable, admins can't remove admins, only the owner changes roles.
 * Target rows are always looked up *within* the caller's community (no IDOR).
 */
import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { optionalUserId } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import {
  COMMUNITY_LIMITS,
  canChangeRole,
  canModerate,
  canRemove,
  communityCopyError,
  inviteExpiry,
  isCommunityVisibility,
  type CommunityActionResult,
  type CommunityRoleKey,
} from "@/lib/communities";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

const DENIED_MESSAGE = "Only this community's owner or admins can do that.";
const DENIED: CommunityActionResult = { ok: false, error: DENIED_MESSAGE };

/** The caller's ACTIVE owner/admin membership in the community named by the form, or null. */
async function moderator(formData: FormData) {
  const userId = await optionalUserId();
  if (!userId) return null;
  const communityId = str(formData, "communityId");
  if (!communityId) return null;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: {
      role: true,
      status: true,
      community: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!membership || !canModerate(membership)) return null;
  return { userId, role: membership.role as CommunityRoleKey, community: membership.community };
}

/** A membership row inside this community (never another community's). */
function memberInCommunity(communityId: string, memberId: string) {
  return prisma.communityMember.findFirst({
    where: { id: memberId, communityId },
    select: { id: true, userId: true, role: true, status: true },
  });
}

export async function approveMember(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const target = await memberInCommunity(mod.community.id, str(formData, "memberId"));
  if (!target || target.status !== "PENDING") return { ok: false, error: "That request is no longer pending." };
  await prisma.communityMember.update({ where: { id: target.id }, data: { status: "ACTIVE", role: "MEMBER" } });
  await notify(target.userId, "community_approved", `You're in: ${mod.community.name}`, `/communities/${mod.community.slug}`);
  refresh();
  return { ok: true, message: "Approved." };
}

export async function rejectMember(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const target = await memberInCommunity(mod.community.id, str(formData, "memberId"));
  if (!target || target.status !== "PENDING") return { ok: false, error: "That request is no longer pending." };
  await prisma.communityMember.delete({ where: { id: target.id } });
  refresh();
  return { ok: true, message: "Request declined." };
}

/** Remove an active member. They can come back only through an invite link. */
export async function removeMember(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const target = await memberInCommunity(mod.community.id, str(formData, "memberId"));
  if (!target || target.status !== "ACTIVE") return { ok: false, error: "That member is no longer active." };
  if (target.userId === mod.userId) return { ok: false, error: "You can't remove yourself — leave the community instead." };
  if (!canRemove(mod.role, target.role)) {
    return {
      ok: false,
      error: target.role === "OWNER" ? "The owner can't be removed." : "Only the owner can remove an admin.",
    };
  }
  await prisma.communityMember.update({ where: { id: target.id }, data: { status: "REMOVED", role: "MEMBER" } });
  refresh();
  return { ok: true, message: "Member removed." };
}

/** Promote to admin / demote to member. Owner only. */
export async function setMemberRole(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const role = str(formData, "role");
  if (role !== "ADMIN" && role !== "MEMBER") return { ok: false, error: "Choose admin or member." };
  const target = await memberInCommunity(mod.community.id, str(formData, "memberId"));
  if (!target || target.status !== "ACTIVE") return { ok: false, error: "That member is no longer active." };
  if (!canChangeRole(mod.role, target.role)) return { ok: false, error: "Only the owner can change roles." };
  await prisma.communityMember.update({ where: { id: target.id }, data: { role } });
  if (role === "ADMIN" && target.role !== "ADMIN") {
    await notify(target.userId, "community_role", `You're now an admin of ${mod.community.name}`, `/communities/${mod.community.slug}/admin`);
  }
  refresh();
  return { ok: true, message: role === "ADMIN" ? "Promoted to admin." : "Changed to member." };
}

/** Private note on a member, visible to owners/admins only. */
export async function saveAdminNote(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const target = await memberInCommunity(mod.community.id, str(formData, "memberId"));
  if (!target) return { ok: false, error: "That member is gone." };
  const note = str(formData, "adminNote").slice(0, COMMUNITY_LIMITS.adminNote);
  await prisma.communityMember.update({ where: { id: target.id }, data: { adminNote: note || null } });
  refresh();
  return { ok: true, message: "Note saved." };
}

export type SettingsState =
  | {
      ok?: boolean;
      error?: string;
      /** Submitted values, echoed back on error so the form keeps the edits. */
      values?: { description: string; rules: string; visibility: string; requireApproval: boolean };
    }
  | undefined;

/** Edit description, rules, visibility, and approval requirement. */
export async function updateCommunitySettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const mod = await moderator(formData);
  if (!mod) return { error: DENIED_MESSAGE };
  const values = {
    description: str(formData, "description"),
    rules: str(formData, "rules"),
    visibility: str(formData, "visibility"),
    requireApproval: formData.get("requireApproval") === "on",
  };
  const fail = (error: string): SettingsState => ({ error, values });
  if (values.description.length > COMMUNITY_LIMITS.description) {
    return fail(`Keep the description under ${COMMUNITY_LIMITS.description} characters.`);
  }
  if (values.rules.length > COMMUNITY_LIMITS.rules) return fail(`Keep the rules under ${COMMUNITY_LIMITS.rules} characters.`);
  if (!isCommunityVisibility(values.visibility)) return fail("Choose public or private.");
  const copyError = communityCopyError([values.description, values.rules]);
  if (copyError) return fail(copyError);

  await prisma.community.update({
    where: { id: mod.community.id },
    data: {
      description: values.description || null,
      rules: values.rules || null,
      visibility: values.visibility,
      requireApproval: values.requireApproval,
    },
  });
  refresh();
  return { ok: true };
}

/** New 7-day invite link. */
export async function createInvite(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const r = checkRateLimit(`community:invite:create:${mod.userId}`, { limit: 20, windowMs: 60 * 60_000 });
  if (!r.ok) return { ok: false, error: "Too many invite links. Try again later." };
  await prisma.communityInvite.create({
    data: {
      communityId: mod.community.id,
      token: randomBytes(24).toString("base64url"),
      invitedById: mod.userId,
      expiresAt: inviteExpiry(),
    },
  });
  refresh();
  return { ok: true, message: "Invite link created." };
}

export async function revokeInvite(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const { count } = await prisma.communityInvite.deleteMany({
    where: { id: str(formData, "inviteId"), communityId: mod.community.id },
  });
  refresh();
  return count > 0 ? { ok: true, message: "Invite revoked." } : { ok: false, error: "That invite is already gone." };
}

/** A live post in this community (never another community's). */
function postInCommunity(communityId: string, postId: string) {
  return prisma.post.findFirst({ where: { id: postId, communityId, removedAt: null }, select: { id: true } });
}

/** Keep the post; close its open flags. */
export async function resolveFlags(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const post = await postInCommunity(mod.community.id, str(formData, "postId"));
  if (!post) return { ok: false, error: "That post is gone." };
  await prisma.postFlag.updateMany({ where: { postId: post.id, status: "OPEN" }, data: { status: "RESOLVED" } });
  refresh();
  return { ok: true, message: "Flags resolved; post kept." };
}

/** Remove the flagged post (soft delete) and close its flags. */
export async function removeFlaggedPost(formData: FormData): Promise<CommunityActionResult> {
  const mod = await moderator(formData);
  if (!mod) return DENIED;
  const post = await postInCommunity(mod.community.id, str(formData, "postId"));
  if (!post) return { ok: false, error: "That post is gone." };
  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { removedAt: new Date() } }),
    prisma.postFlag.updateMany({ where: { postId: post.id, status: "OPEN" }, data: { status: "RESOLVED" } }),
  ]);
  refresh();
  return { ok: true, message: "Post removed." };
}
