/**
 * Community permissions + input rules. Pure — every server action and page in
 * src/app/(app)/communities calls these, and nothing here touches the database,
 * so the rules are unit-tested in one place.
 *
 * Communities are research rooms: members discuss methods, evidence, and
 * post-mortems. They are never paid signal rooms, copy-trading groups, or
 * allocation channels (see CLAUDE.md guardrails).
 */

export type CommunityVisibilityKey = "PUBLIC" | "PRIVATE";
export type CommunityRoleKey = "OWNER" | "ADMIN" | "MEMBER";
export type MembershipStatusKey = "PENDING" | "ACTIVE" | "REMOVED";

export interface MembershipLike {
  role: CommunityRoleKey;
  status: MembershipStatusKey;
}

export const COMMUNITY_GUARDRAIL =
  "Rooms discuss methods, evidence, and post-mortems. Paid signal rooms, copy-trading groups, and allocation channels are not allowed.";

export const INVITE_TTL_DAYS = 7;

export const COMMUNITY_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  slugMin: 3,
  slugMax: 40,
  description: 1000,
  rules: 2000,
  adminNote: 500,
} as const;

/** Slugs that collide with /communities/* routes or read as official. */
const RESERVED_SLUGS = new Set(["join", "new", "admin", "create", "settings", "trustsvan", "official", "support"]);

export const ROLE_LABEL: Record<CommunityRoleKey, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

function isActive(m: MembershipLike | null | undefined): m is MembershipLike {
  return m?.status === "ACTIVE";
}

/**
 * Who may see a community's description, roster, and posts.
 * Public → any signed-in user. Private → active members only.
 */
export function canView(
  visibility: CommunityVisibilityKey,
  membership: MembershipLike | null | undefined,
  signedIn: boolean,
): boolean {
  if (!signedIn) return false;
  if (visibility === "PUBLIC") return true;
  return isActive(membership);
}

/** Any active member — trader or client, any role — may post inside the community. */
export function canPost(membership: MembershipLike | null | undefined): boolean {
  return isActive(membership);
}

/** Owners and admins moderate: approvals, removals, flags, invites, settings. */
export function canModerate(membership: MembershipLike | null | undefined): boolean {
  return isActive(membership) && (membership.role === "OWNER" || membership.role === "ADMIN");
}

/**
 * Whether `actorRole` may remove a member holding `targetRole`. The owner can
 * never be removed; admins can remove members only (removing an admin is an
 * owner decision).
 */
export function canRemove(actorRole: CommunityRoleKey, targetRole: CommunityRoleKey): boolean {
  if (targetRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

/** Promote/demote between MEMBER and ADMIN — owner only, never on the owner row. */
export function canChangeRole(actorRole: CommunityRoleKey, targetRole: CommunityRoleKey): boolean {
  return actorRole === "OWNER" && targetRole !== "OWNER";
}

/** The owner can't leave (the room would be orphaned); everyone else can. */
export function canLeave(membership: MembershipLike | null | undefined): boolean {
  return !!membership && membership.status !== "REMOVED" && membership.role !== "OWNER";
}

/**
 * What a join attempt does.
 * - `ACTIVE`   — becomes an active member now.
 * - `PENDING`  — a request the owner/admins must approve.
 * - `DENIED`   — removed members can come back only through an invite.
 * - `UNCHANGED`— already active (or already pending without an invite).
 *
 * An invite bypasses approval and re-activates removed members. Without one, a
 * member joins directly only when the community is public and open.
 */
export type JoinOutcome = "ACTIVE" | "PENDING" | "DENIED" | "UNCHANGED";

export function joinOutcome(
  visibility: CommunityVisibilityKey,
  requireApproval: boolean,
  viaInvite: boolean,
  currentStatus: MembershipStatusKey | null = null,
): JoinOutcome {
  if (currentStatus === "ACTIVE") return "UNCHANGED";
  if (viaInvite) return "ACTIVE";
  if (currentStatus === "REMOVED") return "DENIED";
  if (currentStatus === "PENDING") return "UNCHANGED";
  return visibility === "PUBLIC" && !requireApproval ? "ACTIVE" : "PENDING";
}

/** Whether an invite can still be used at `now`. */
export function inviteIsUsable(invite: { expiresAt: Date } | null | undefined, now: Date = new Date()): boolean {
  return !!invite && invite.expiresAt.getTime() > now.getTime();
}

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** "Global Macro Desk!" → "global-macro-desk". */
export function slugifyCommunity(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, COMMUNITY_LIMITS.slugMax)
    .replace(/-+$/g, "");
}

/** Null when the slug is usable, otherwise a user-facing reason. */
export function communitySlugError(slug: string): string | null {
  if (slug.length < COMMUNITY_LIMITS.slugMin) return `Use at least ${COMMUNITY_LIMITS.slugMin} letters or numbers for the link.`;
  if (slug.length > COMMUNITY_LIMITS.slugMax) return `Keep the link under ${COMMUNITY_LIMITS.slugMax} characters.`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, numbers, and single dashes.";
  if (RESERVED_SLUGS.has(slug)) return "That link is reserved. Choose another.";
  return null;
}

export function isCommunityVisibility(value: unknown): value is CommunityVisibilityKey {
  return value === "PUBLIC" || value === "PRIVATE";
}
