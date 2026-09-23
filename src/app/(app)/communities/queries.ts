/**
 * Community reads for the /communities pages. Callers check access first
 * (communityAccessBySlug in src/lib/post-queries.ts) — these functions only
 * shape data. Counts are factual (members, members with a published record);
 * nothing here ranks by return or score.
 */
import { prisma } from "@/lib/db";
import { recordContextByUser, type RecordContext } from "@/lib/record-context";
import type { CommunityRole, CommunityVisibility, MembershipStatus } from "@/generated/prisma/enums";

/** ACTIVE members whose trader profile is public and has a published version. */
const WITH_PUBLISHED_RECORD = {
  status: "ACTIVE" as const,
  user: { profile: { is: { isPublic: true, versions: { some: {} } } } },
};

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  requireApproval: boolean;
  activeMembers: number;
  withRecord: number;
}

async function summarize(
  rows: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: CommunityVisibility;
    requireApproval: boolean;
  }[],
): Promise<CommunitySummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [active, withRecord] = await Promise.all([
    prisma.communityMember.groupBy({
      by: ["communityId"],
      where: { communityId: { in: ids }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.communityMember.groupBy({
      by: ["communityId"],
      where: { communityId: { in: ids }, ...WITH_PUBLISHED_RECORD },
      _count: { _all: true },
    }),
  ]);
  const activeBy = new Map(active.map((g) => [g.communityId, g._count._all]));
  const recordBy = new Map(withRecord.map((g) => [g.communityId, g._count._all]));
  return rows.map((r) => ({
    ...r,
    activeMembers: activeBy.get(r.id) ?? 0,
    withRecord: recordBy.get(r.id) ?? 0,
  }));
}

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  visibility: true,
  requireApproval: true,
} as const;

/** Public communities, newest first. Private communities are never listed. */
export async function discoverCommunities(limit = 60): Promise<CommunitySummary[]> {
  const rows = await prisma.community.findMany({
    where: { visibility: "PUBLIC" },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return summarize(rows);
}

export interface MyCommunity extends CommunitySummary {
  role: CommunityRole;
  status: MembershipStatus;
}

/** The viewer's active memberships and pending requests. */
export async function myCommunities(userId: string): Promise<MyCommunity[]> {
  const memberships = await prisma.communityMember.findMany({
    where: { userId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { role: true, status: true, community: { select: SUMMARY_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  const summaries = await summarize(memberships.map((m) => m.community));
  const byId = new Map(summaries.map((s) => [s.id, s]));
  return memberships.map((m) => {
    const summary = byId.get(m.community.id)!;
    // Hide a private community's description from someone whose request is still pending.
    const description = m.status === "ACTIVE" || summary.visibility === "PUBLIC" ? summary.description : null;
    return { ...summary, description, role: m.role, status: m.status };
  });
}

export interface RosterMember {
  memberId: string;
  userId: string;
  name: string;
  slug: string | null;
  role: CommunityRole;
  userRole: "TRADER" | "CLIENT" | null;
  record: (RecordContext & { slug: string }) | null;
  joinedAt: string;
}

const ROLE_ORDER: Record<CommunityRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

/** Active members with role + factual record context (never returns or scores). */
export async function communityRoster(communityId: string, limit = 300): Promise<RosterMember[]> {
  const members = await prisma.communityMember.findMany({
    where: { communityId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          profile: { select: { displayName: true, slug: true, isPublic: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const records = await recordContextByUser(members.map((m) => m.user.id));
  return members
    .map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.profile?.displayName || m.user.name || "Member",
      slug: m.user.profile?.isPublic ? m.user.profile.slug : null,
      role: m.role,
      userRole: m.user.role,
      record: records.get(m.user.id) ?? null,
      joinedAt: m.createdAt.toISOString(),
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/** Full community row for members/public viewers (caller has checked canView). */
export function communityDetail(communityId: string) {
  return prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      rules: true,
      visibility: true,
      requireApproval: true,
      createdAt: true,
      owner: { select: { name: true, profile: { select: { displayName: true } } } },
    },
  });
}

/** Everything the admin page needs (caller has checked canModerate). */
export async function communityAdminData(communityId: string) {
  const now = new Date();
  const [pending, members, invites, flaggedPosts] = await Promise.all([
    prisma.communityMember.findMany({
      where: { communityId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: { select: { displayName: true, slug: true, isPublic: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.communityMember.findMany({
      where: { communityId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        adminNote: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: { select: { displayName: true, slug: true, isPublic: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.communityInvite.findMany({
      where: { communityId, expiresAt: { gt: now } },
      select: {
        id: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        uses: true,
        invitedBy: { select: { name: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.findMany({
      where: { communityId, removedAt: null, flags: { some: { status: "OPEN" } } },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        author: { select: { name: true, profile: { select: { displayName: true } } } },
        flags: {
          where: { status: "OPEN" },
          select: { id: true, reason: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const records = await recordContextByUser([...members, ...pending].map((m) => m.user.id));
  const nameOf = (u: { name: string | null; profile: { displayName: string } | null }) =>
    u.profile?.displayName || u.name || "Member";
  return {
    pending: pending.map((p) => ({
      memberId: p.id,
      name: nameOf(p.user),
      slug: p.user.profile?.isPublic ? p.user.profile.slug : null,
      userRole: p.user.role,
      requestedAt: p.createdAt.toISOString(),
      record: records.get(p.user.id) ?? null,
    })),
    members: members
      .map((m) => ({
        memberId: m.id,
        userId: m.user.id,
        name: nameOf(m.user),
        slug: m.user.profile?.isPublic ? m.user.profile.slug : null,
        role: m.role,
        userRole: m.user.role,
        adminNote: m.adminNote,
        record: records.get(m.user.id) ?? null,
      }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
    invites: invites.map((i) => ({
      id: i.id,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      uses: i.uses,
      invitedBy: nameOf(i.invitedBy),
    })),
    flagged: flaggedPosts.map((p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.body.slice(0, 280),
      createdAt: p.createdAt.toISOString(),
      author: nameOf(p.author),
      flags: p.flags.map((f) => ({ id: f.id, reason: f.reason, createdAt: f.createdAt.toISOString() })),
    })),
  };
}
