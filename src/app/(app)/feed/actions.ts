"use server";

/**
 * Post, like, flag, and comment mutations. Every action re-checks the session
 * and the caller's access to the post on the server (post-queries.postAccess
 * enforces community visibility and hides removed posts) — ids from the client
 * are never trusted on their own.
 */
import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { optionalUserId } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import {
  FIELD_PREFIX,
  POST_TYPE_DEFS,
  flagReason,
  isPostType,
  matchAnySymbol,
  validateComment,
  validatePostInput,
} from "@/lib/posts";
import { canDeleteComment, communityAccessById, postAccess } from "@/lib/post-queries";
import { toISODate } from "@/lib/format";

export type ComposerResult =
  | {
      ok: true;
      postId: string;
      /** Neutral outcome of execution matching for trade reviews. */
      notice?: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ActionResult = { ok: true } | { ok: false; error: string };

const SIGN_IN = "Sign in to continue.";
const UNAVAILABLE = "This post is no longer available.";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function limited(key: string, limit: number, windowMs: number): string | null {
  const r = checkRateLimit(key, { limit, windowMs });
  return r.ok ? null : `You're doing that too often. Try again in ${Math.max(1, Math.ceil(r.retryAfterSeconds / 60))} min.`;
}

/**
 * Create a post. Top-level (non-community) posts: traders with a profile only.
 * Community posts: any ACTIVE member of that community.
 */
export async function createPost(formData: FormData): Promise<ComposerResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { id: true } } },
  });
  if (!user?.role) return { ok: false, error: "Finish onboarding before posting." };

  const communityIdRaw = str(formData, "communityId").trim();
  let communityId: string | null = null;
  if (communityIdRaw) {
    const access = await communityAccessById(communityIdRaw, userId);
    if (!access?.canPost) return { ok: false, error: "Only active members can post in this community." };
    communityId = access.community.id;
  } else if (user.role !== "TRADER" || !user.profile) {
    return { ok: false, error: "Only traders with a profile can post to the main feed. Join a community to post there." };
  }

  const typeRaw = str(formData, "type");
  const fields: Record<string, unknown> = {};
  if (isPostType(typeRaw)) {
    for (const f of POST_TYPE_DEFS[typeRaw].fields) fields[f.key] = formData.get(`${FIELD_PREFIX}${f.key}`);
  }
  const parsed = validatePostInput({
    type: typeRaw,
    title: formData.get("title"),
    body: formData.get("body"),
    symbols: formData.get("symbols"),
    fields,
  });
  if (!parsed.ok) return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  const post = parsed.post;

  // Counted only for valid submissions, so fixing validation errors doesn't burn the quota.
  const tooOften = limited(`post:create:${userId}`, 8, 10 * 60_000);
  if (tooOften) return { ok: false, error: tooOften };

  // Record context at posting time: the author's latest published version.
  const latestVersion = user.profile
    ? await prisma.profileVersion.findFirst({
        where: { profileId: user.profile.id },
        orderBy: { versionNumber: "desc" },
        select: { id: true },
      })
    : null;
  if (post.type === "PERFORMANCE_UPDATE" && !latestVersion) {
    return {
      ok: false,
      error: user.profile
        ? "A performance update attaches your latest published record — publish your record from the dashboard first."
        : "Performance updates are for traders with a published record.",
    };
  }

  // Verified-position badge: only when one of the author's own imported
  // executions matches a post symbol on the reviewed date.
  let verifiedTradeId: string | null = null;
  let notice: string | undefined;
  if (post.type === "TRADE_REVIEW" && post.fields.tradeDate) {
    const trades = await prisma.trade.findMany({
      where: {
        tradeDate: new Date(`${post.fields.tradeDate}T00:00:00.000Z`),
        account: { userId },
      },
      select: { id: true, symbol: true, tradeDate: true },
      take: 5000,
    });
    verifiedTradeId = matchAnySymbol(
      trades.map((t) => ({ id: t.id, symbol: t.symbol, tradeDate: toISODate(t.tradeDate) })),
      post.symbols,
      post.fields.tradeDate,
    );
    notice = verifiedTradeId
      ? "Matches an imported execution — the post carries a verified-position badge."
      : "No matching imported execution for that symbol and date. The review is posted without a verified-position badge.";
  }

  const created = await prisma.post.create({
    data: {
      authorId: userId,
      communityId,
      type: post.type,
      title: post.title,
      body: post.body,
      symbols: post.symbols,
      fields: post.fields,
      verifiedTradeId,
      versionId: latestVersion?.id ?? null,
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, postId: created.id, notice };
}

/** Like / unlike. Returns the new state and count. */
export async function toggleLike(
  postId: string,
): Promise<{ ok: true; liked: boolean; count: number } | { ok: false; error: string }> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };
  const access = await postAccess(String(postId), userId);
  if (!access) return { ok: false, error: UNAVAILABLE };
  const tooOften = limited(`post:like:${userId}`, 120, 60_000);
  if (tooOften) return { ok: false, error: tooOften };

  const key = { postId_userId: { postId: access.post.id, userId } };
  const existing = await prisma.postLike.findUnique({ where: key, select: { postId: true } });
  if (existing) {
    await prisma.postLike.deleteMany({ where: { postId: access.post.id, userId } });
  } else {
    await prisma.postLike.upsert({ where: key, create: { postId: access.post.id, userId }, update: {} });
  }
  const count = await prisma.postLike.count({ where: { postId: access.post.id } });
  refresh();
  return { ok: true, liked: !existing, count };
}

/** Flag a post for review. Signed-in non-authors only; one flag per reader per post. */
export async function flagPost(formData: FormData): Promise<ActionResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };
  const access = await postAccess(str(formData, "postId"), userId);
  if (!access) return { ok: false, error: UNAVAILABLE };
  if (access.isAuthor) return { ok: false, error: "You can't flag your own post." };

  const reason = flagReason(formData.get("reason"), formData.get("note"));
  if (!reason) return { ok: false, error: "Choose a reason." };
  const tooOften = limited(`post:flag:${userId}`, 20, 60 * 60_000);
  if (tooOften) return { ok: false, error: tooOften };

  const key = { postId_reporterId: { postId: access.post.id, reporterId: userId } };
  const existing = await prisma.postFlag.findUnique({ where: key, select: { status: true } });
  if (existing?.status === "OPEN") return { ok: false, error: "You've already flagged this post." };
  if (existing) {
    await prisma.postFlag.update({ where: key, data: { reason, status: "OPEN" } });
  } else {
    await prisma.postFlag.create({ data: { postId: access.post.id, reporterId: userId, reason } });
  }
  refresh();
  return { ok: true };
}

/** Soft-delete a post: its author, or an owner/admin of the post's community. */
export async function deletePost(postId: string): Promise<ActionResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };
  const access = await postAccess(String(postId), userId);
  if (!access) return { ok: false, error: UNAVAILABLE };
  if (!access.isAuthor && !access.canModerate) return { ok: false, error: "You can't remove this post." };

  await prisma.$transaction([
    prisma.post.update({ where: { id: access.post.id }, data: { removedAt: new Date() } }),
    prisma.postFlag.updateMany({ where: { postId: access.post.id, status: "OPEN" }, data: { status: "RESOLVED" } }),
  ]);
  refresh();
  return { ok: true };
}

/** Add a comment. Notifies the post author (never for their own comments). */
export async function createComment(formData: FormData): Promise<ActionResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };
  const access = await postAccess(str(formData, "postId"), userId);
  if (!access) return { ok: false, error: UNAVAILABLE };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true, profile: { select: { displayName: true } } },
  });
  if (!user?.role) return { ok: false, error: "Finish onboarding before commenting." };

  const checked = validateComment(formData.get("body"));
  if (!checked.ok) return { ok: false, error: checked.error };
  const tooOften = limited(`post:comment:${userId}`, 20, 10 * 60_000);
  if (tooOften) return { ok: false, error: tooOften };

  await prisma.postComment.create({ data: { postId: access.post.id, authorId: userId, body: checked.body } });
  if (access.post.authorId !== userId) {
    const who = user.profile?.displayName || user.name || "Someone";
    await notify(access.post.authorId, "comment", `${who} commented on "${access.post.title}"`, `/feed/${access.post.id}`);
  }
  refresh();
  return { ok: true };
}

/** Delete a comment: its author, the post's author, or a community owner/admin. */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const userId = await optionalUserId();
  if (!userId) return { ok: false, error: SIGN_IN };
  const comment = await prisma.postComment.findUnique({
    where: { id: String(commentId) },
    select: { id: true, authorId: true, postId: true },
  });
  if (!comment) return { ok: false, error: "That comment is gone." };
  const access = await postAccess(comment.postId, userId);
  if (!access) return { ok: false, error: UNAVAILABLE };
  if (!canDeleteComment(access, comment.authorId, userId)) return { ok: false, error: "You can't delete this comment." };

  await prisma.postComment.delete({ where: { id: comment.id } });
  refresh();
  return { ok: true };
}
