/**
 * Post + community read access. Every list and every post action goes through
 * these so the visibility rules live in one place:
 *
 * - Removed posts (`removedAt`) are never returned.
 * - Non-community posts are readable by anyone (the public profile's Posts tab
 *   shows them to signed-out visitors); acting on them requires sign-in.
 * - Community posts follow the community: public → any signed-in user,
 *   private → active members only (see src/lib/communities.ts).
 *
 * Server-only (Prisma). Pure rules live in src/lib/posts.ts and src/lib/communities.ts.
 */
import { prisma } from "@/lib/db";
import { canModerate, canPost, canView, type MembershipLike } from "@/lib/communities";
import {
  POST_TYPE_DEFS,
  isPostType,
  postFieldEntries,
  verifiedSymbol,
  type PostTypeKey,
} from "@/lib/posts";
import {
  RECORD_VERSION_SELECT,
  recordContextByUser,
  toRecordContext,
  type RecordContext,
} from "@/lib/record-context";
import { toISODate } from "@/lib/format";
import type { CommunityVisibility } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const POST_PAGE_SIZE = 20;
const COMMENT_LIMIT = 200;

// ─────────────────────────────────────────────────────────────
// Community access
// ─────────────────────────────────────────────────────────────

export interface CommunityAccess {
  community: {
    id: string;
    slug: string;
    name: string;
    visibility: CommunityVisibility;
    requireApproval: boolean;
    ownerId: string;
  };
  membership: (MembershipLike & { id: string }) | null;
  viewable: boolean;
  canPost: boolean;
  canModerate: boolean;
}

const COMMUNITY_ACCESS_SELECT = {
  id: true,
  slug: true,
  name: true,
  visibility: true,
  requireApproval: true,
  ownerId: true,
} as const;

async function withMembership(
  community: CommunityAccess["community"] | null,
  viewerId: string | null,
): Promise<CommunityAccess | null> {
  if (!community) return null;
  const membership = viewerId
    ? await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: viewerId } },
        select: { id: true, role: true, status: true },
      })
    : null;
  return {
    community,
    membership,
    viewable: canView(community.visibility, membership, !!viewerId),
    canPost: canPost(membership),
    canModerate: canModerate(membership),
  };
}

export async function communityAccessById(communityId: string, viewerId: string | null) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: COMMUNITY_ACCESS_SELECT,
  });
  return withMembership(community, viewerId);
}

export async function communityAccessBySlug(slug: string, viewerId: string | null) {
  const community = await prisma.community.findUnique({
    where: { slug },
    select: COMMUNITY_ACCESS_SELECT,
  });
  return withMembership(community, viewerId);
}

// ─────────────────────────────────────────────────────────────
// Single-post access (used by every post/comment action)
// ─────────────────────────────────────────────────────────────

export interface PostAccess {
  post: { id: string; authorId: string; communityId: string | null; title: string };
  community: CommunityAccess | null;
  isAuthor: boolean;
  /** Community owner/admin for the post's community (never for non-community posts). */
  canModerate: boolean;
}

/** A live post the viewer may see, with what they may do to it — or null. */
export async function postAccess(postId: string, viewerId: string | null): Promise<PostAccess | null> {
  if (!postId) return null;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, communityId: true, title: true, removedAt: true },
  });
  if (!post || post.removedAt) return null;
  let community: CommunityAccess | null = null;
  if (post.communityId) {
    community = await communityAccessById(post.communityId, viewerId);
    if (!community?.viewable) return null;
  }
  return {
    post: { id: post.id, authorId: post.authorId, communityId: post.communityId, title: post.title },
    community,
    isAuthor: !!viewerId && post.authorId === viewerId,
    canModerate: community?.canModerate ?? false,
  };
}

// ─────────────────────────────────────────────────────────────
// Post lists
// ─────────────────────────────────────────────────────────────

export interface PostAuthor {
  id: string;
  name: string;
  /** Public profile slug, only when the profile is public. */
  slug: string | null;
  role: "TRADER" | "CLIENT" | null;
}

export interface PostView {
  id: string;
  type: PostTypeKey;
  typeLabel: string;
  title: string;
  body: string;
  symbols: string[];
  fields: { key: string; label: string; value: string }[];
  createdAt: string;
  author: PostAuthor;
  /** Author's latest published public record (factual context, never a score). */
  record: (RecordContext & { slug: string }) | null;
  /** The record version attached at posting time (performance updates). */
  attachedRecord: RecordContext | null;
  /** Set only when an imported execution genuinely matched. */
  verified: { symbol: string; date: string } | null;
  /** A trade review with no matching imported execution (neutral note). */
  reviewUnmatched: boolean;
  community: { slug: string; name: string } | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  flagged: boolean;
  isAuthor: boolean;
  canModerate: boolean;
}

const POST_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  symbols: true,
  fields: true,
  createdAt: true,
  authorId: true,
  communityId: true,
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      profile: { select: { slug: true, isPublic: true, displayName: true } },
    },
  },
  community: { select: { slug: true, name: true } },
  verifiedTrade: { select: { symbol: true, tradeDate: true } },
  version: { select: RECORD_VERSION_SELECT },
  _count: { select: { likes: true, comments: true } },
} as const;

type PostRow = Awaited<ReturnType<typeof fetchRows>>[number];

function fetchRows(where: Prisma.PostWhereInput, take: number) {
  return prisma.post.findMany({
    where,
    select: POST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

export function authorView(author: PostRow["author"]): PostAuthor {
  const profile = author.profile;
  return {
    id: author.id,
    name: profile?.displayName || author.name || "Member",
    slug: profile?.isPublic ? profile.slug : null,
    role: author.role,
  };
}

async function hydrate(
  rows: PostRow[],
  viewerId: string | null,
  moderatorOf: ReadonlySet<string>,
): Promise<PostView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [records, likes, flags] = await Promise.all([
    recordContextByUser(rows.map((r) => r.authorId)),
    viewerId
      ? prisma.postLike.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } })
      : Promise.resolve([]),
    viewerId
      ? prisma.postFlag.findMany({ where: { reporterId: viewerId, postId: { in: ids } }, select: { postId: true } })
      : Promise.resolve([]),
  ]);
  const liked = new Set(likes.map((l) => l.postId));
  const flagged = new Set(flags.map((f) => f.postId));

  return rows.flatMap((row) => {
    if (!isPostType(row.type)) return [];
    const type = row.type;
    const verified = row.verifiedTrade
      ? (() => {
          const date = toISODate(row.verifiedTrade.tradeDate);
          return { symbol: verifiedSymbol(row.symbols, { symbol: row.verifiedTrade.symbol, tradeDate: date }), date };
        })()
      : null;
    return [
      {
        id: row.id,
        type,
        typeLabel: POST_TYPE_DEFS[type].label,
        title: row.title,
        body: row.body,
        symbols: row.symbols,
        fields: postFieldEntries(type, row.fields),
        createdAt: row.createdAt.toISOString(),
        author: authorView(row.author),
        record: records.get(row.authorId) ?? null,
        attachedRecord: type === "PERFORMANCE_UPDATE" && row.version ? toRecordContext(row.version) : null,
        verified,
        reviewUnmatched: type === "TRADE_REVIEW" && !verified,
        community: row.community,
        likeCount: row._count.likes,
        commentCount: row._count.comments,
        liked: liked.has(row.id),
        flagged: flagged.has(row.id),
        isAuthor: !!viewerId && row.authorId === viewerId,
        canModerate: !!row.communityId && moderatorOf.has(row.communityId),
      },
    ];
  });
}

export interface PostListQuery {
  viewerId: string | null;
  /** Restrict to these authors (an empty list returns nothing). */
  authorIds?: string[];
  /** Community-scoped posts; omitted/null ⇒ only non-community posts. */
  communityId?: string | null;
  type?: PostTypeKey | null;
  /** Id of the last post on the previous page. */
  cursor?: string | null;
  limit?: number;
}

export interface PostListResult {
  posts: PostView[];
  nextCursor: string | null;
  /** True when the viewer may not see the requested community. */
  hidden: boolean;
}

export async function listPosts(q: PostListQuery): Promise<PostListResult> {
  const limit = Math.min(Math.max(q.limit ?? POST_PAGE_SIZE, 1), 50);
  const empty: PostListResult = { posts: [], nextCursor: null, hidden: false };
  if (q.authorIds && q.authorIds.length === 0) return empty;

  const moderatorOf = new Set<string>();
  if (q.communityId) {
    const access = await communityAccessById(q.communityId, q.viewerId);
    if (!access?.viewable) return { ...empty, hidden: true };
    if (access.canModerate) moderatorOf.add(access.community.id);
  }

  const where: Prisma.PostWhereInput = {
    removedAt: null,
    communityId: q.communityId ?? null,
  };
  if (q.authorIds) where.authorId = { in: [...new Set(q.authorIds)] };
  if (q.type) where.type = q.type;

  if (q.cursor) {
    // Keyset pagination on (createdAt, id) — stable even when new posts arrive.
    const anchor = await prisma.post.findUnique({ where: { id: q.cursor }, select: { id: true, createdAt: true } });
    if (anchor) {
      where.OR = [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ];
    }
  }

  const rows = await fetchRows(where, limit + 1);
  const page = rows.slice(0, limit);
  const posts = await hydrate(page, q.viewerId, moderatorOf);
  return { posts, nextCursor: rows.length > limit ? page[page.length - 1].id : null, hidden: false };
}

/** User ids of the traders the viewer follows (the Following tab). */
export async function followedAuthorIds(viewerId: string): Promise<string[]> {
  const follows = await prisma.follow.findMany({
    where: { userId: viewerId },
    select: { profile: { select: { userId: true } } },
  });
  return follows.map((f) => f.profile.userId);
}

/** One post for the detail page, given access already granted by postAccess(). */
export async function loadPostView(access: PostAccess, viewerId: string | null): Promise<PostView | null> {
  const rows = await fetchRows({ id: access.post.id, removedAt: null }, 1);
  const moderatorOf = new Set<string>();
  if (access.canModerate && access.post.communityId) moderatorOf.add(access.post.communityId);
  const [post] = await hydrate(rows, viewerId, moderatorOf);
  return post ?? null;
}

// ─────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthor;
  canDelete: boolean;
}

/** Whether `viewerId` may delete a comment: its author, the post's author, or a community moderator. */
export function canDeleteComment(access: PostAccess, commentAuthorId: string, viewerId: string | null): boolean {
  if (!viewerId) return false;
  return commentAuthorId === viewerId || access.isAuthor || access.canModerate;
}

/** Comments on a post the caller has already access-checked (oldest first). */
export async function listComments(access: PostAccess, viewerId: string | null): Promise<CommentView[]> {
  const rows = await prisma.postComment.findMany({
    where: { postId: access.post.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: COMMENT_LIMIT,
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          profile: { select: { slug: true, isPublic: true, displayName: true } },
        },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: authorView(c.author),
    canDelete: canDeleteComment(access, c.authorId, viewerId),
  }));
}
