"use server";

/**
 * Professional inquiries + inbox actions. Every action re-reads the session and
 * re-checks role / ownership on the server — ids arriving in FormData are
 * untrusted. State rules live in src/lib/inquiries.ts.
 */
import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { optionalUserId, requireUserId } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/rate-limit";
import { markNotificationsRead, notify } from "@/lib/notify";
import { pickKey } from "@/lib/profile-options";
import {
  DECISIONS,
  OPEN_STATUSES,
  REQUEST_MESSAGE_MAX,
  THREAD_MESSAGE_MAX,
  canMessage,
  canRequestAgain,
  canTransition,
  isDecision,
  requestAgainAt,
  validateInquiryMessage,
  type Decision,
} from "@/lib/inquiries";

const HOUR_MS = 60 * 60 * 1000;
const UNAVAILABLE = "This conversation isn't available.";

function retryMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------------ */
/* Client → trader: request a conversation                                   */
/* ------------------------------------------------------------------------ */

export type RequestState =
  | {
      ok?: boolean;
      error?: string;
      fieldErrors?: { topic?: string; message?: string };
      values?: { topic: string; message: string };
    }
  | undefined;

export async function createInquiry(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const topicRaw = String(formData.get("topic") ?? "");
  const messageRaw = String(formData.get("message") ?? "");
  const values = { topic: topicRaw, message: messageRaw.slice(0, REQUEST_MESSAGE_MAX + 500) };

  const userId = await optionalUserId();
  if (!userId) return { error: "Sign in with a client account to request a conversation.", values };

  const client = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      role: true,
      clientProfile: { select: { organization: true } },
    },
  });
  if (!client || client.role !== "CLIENT" || !client.clientProfile) {
    return { error: "Conversation requests are sent from client accounts with a completed client profile.", values };
  }

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !profileId) return { error: UNAVAILABLE, values };

  const topic = pickKey("inquiryTopics", topicRaw);
  const message = validateInquiryMessage(messageRaw, "request");
  if (!topic || !message.ok) {
    return {
      fieldErrors: {
        topic: topic ? undefined : "Choose a topic.",
        message: message.ok ? undefined : message.error,
      },
      values,
    };
  }

  const limit = checkRateLimit(`inquiry:create:${userId}`, { limit: 5, windowMs: HOUR_MS });
  if (!limit.ok) {
    return { error: `You've sent several requests recently. Try again in ${retryMinutes(limit.retryAfterSeconds)}.`, values };
  }

  const profile = await prisma.traderProfile.findFirst({
    where: { id: profileId, isPublic: true },
    select: { id: true, userId: true, slug: true, displayName: true, acceptInquiries: true },
  });
  if (!profile) return { error: "This profile isn't available.", values };
  if (profile.userId === userId) return { error: "You can't send a request to your own profile.", values };
  if (!profile.acceptInquiries) {
    return { error: `${profile.displayName} isn't accepting conversation requests right now.`, values };
  }

  // Serialize per client↔profile pair so two quick submits can't both pass the
  // "one open request" check.
  const outcome = await prisma.$transaction(async (tx) => {
    const lockKey = `inquiry:${userId}:${profile.id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const open = await tx.inquiry.findFirst({
      where: { clientId: userId, profileId: profile.id, status: { in: [...OPEN_STATUSES] } },
      select: { id: true },
    });
    if (open) return { kind: "open" as const };

    const latest = await tx.inquiry.findFirst({
      where: { clientId: userId, profileId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, respondedAt: true },
    });
    if (!canRequestAgain(latest, new Date())) {
      return { kind: "cooldown" as const, at: requestAgainAt(latest) };
    }

    const created = await tx.inquiry.create({
      data: { clientId: userId, profileId: profile.id, topic, message: message.value },
      select: { id: true },
    });
    return { kind: "created" as const, id: created.id };
  });

  if (outcome.kind === "open") {
    return { error: `You already have an open request with ${profile.displayName}.`, values };
  }
  if (outcome.kind === "cooldown") {
    return {
      error: outcome.at
        ? `You can send a new request to ${profile.displayName} after ${shortDate(outcome.at)}.`
        : `You already have an open request with ${profile.displayName}.`,
      values,
    };
  }

  const who = client.name?.trim() || "a client";
  const org = client.clientProfile.organization?.trim();
  await notify(
    profile.userId,
    "inquiry_request",
    `New conversation request from ${who}${org ? ` (${org})` : ""}`,
    `/inbox/${outcome.id}`,
  );

  revalidatePath(`/p/${profile.slug}`);
  revalidatePath("/inbox");
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/* Trader: accept / decline / ignore                                         */
/* ------------------------------------------------------------------------ */

export type RespondState = { error?: string; done?: Decision } | undefined;

export async function respondToInquiry(_prev: RespondState, formData: FormData): Promise<RespondState> {
  const userId = await requireUserId();
  const inquiryId = formData.get("inquiryId");
  const decision = formData.get("decision");
  if (typeof inquiryId !== "string" || !inquiryId || !isDecision(decision)) {
    return { error: "Unknown action." };
  }

  const limit = checkRateLimit(`inquiry:respond:${userId}`, { limit: 60, windowMs: HOUR_MS });
  if (!limit.ok) return { error: `Too many updates. Try again in ${retryMinutes(limit.retryAfterSeconds)}.` };

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      status: true,
      clientId: true,
      profileId: true,
      profile: { select: { userId: true, displayName: true, slug: true } },
    },
  });
  // Only the owner of the profile the request was sent to may answer it.
  if (!inquiry || inquiry.profile.userId !== userId) return { error: UNAVAILABLE };

  const to = DECISIONS[decision];
  if (!canTransition(inquiry.status, to)) {
    return { error: "This request has already been answered." };
  }

  if (to === "ACCEPTED" && inquiry.status === "IGNORED") {
    const newer = await prisma.inquiry.findFirst({
      where: {
        clientId: inquiry.clientId,
        profileId: inquiry.profileId,
        id: { not: inquiry.id },
        status: { in: [...OPEN_STATUSES] },
      },
      select: { id: true },
    });
    if (newer) return { error: "This client has a newer request open — respond to that one instead." };
  }

  // Conditional on the status we checked, so a double-click can't apply twice.
  const { count } = await prisma.inquiry.updateMany({
    where: { id: inquiry.id, status: inquiry.status },
    data: { status: to, respondedAt: new Date() },
  });
  if (count === 0) return { error: "This request changed in the meantime. Refresh and try again." };

  const href = `/inbox/${inquiry.id}`;
  if (to === "ACCEPTED") {
    await notify(inquiry.clientId, "inquiry_accepted", `${inquiry.profile.displayName} accepted your conversation request`, href);
  } else if (to === "DECLINED") {
    await notify(inquiry.clientId, "inquiry_declined", `${inquiry.profile.displayName} declined your conversation request`, href);
  }
  // Ignoring is silent — the client just sees "No response".

  revalidatePath("/inbox");
  revalidatePath(href);
  revalidatePath("/dashboard");
  revalidatePath(`/p/${inquiry.profile.slug}`);
  return { done: decision };
}

/* ------------------------------------------------------------------------ */
/* Messaging (accepted inquiries only)                                       */
/* ------------------------------------------------------------------------ */

export type MessageState = { ok?: boolean; error?: string; body?: string } | undefined;

export async function sendInquiryMessage(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const userId = await requireUserId();
  const inquiryId = formData.get("inquiryId");
  const bodyRaw = String(formData.get("body") ?? "");
  const body = bodyRaw.slice(0, THREAD_MESSAGE_MAX + 500);
  if (typeof inquiryId !== "string" || !inquiryId) return { error: UNAVAILABLE, body };

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      status: true,
      clientId: true,
      client: { select: { name: true } },
      profile: { select: { userId: true, displayName: true } },
    },
  });
  const isClient = inquiry?.clientId === userId;
  const isTrader = inquiry?.profile.userId === userId;
  if (!inquiry || (!isClient && !isTrader)) return { error: UNAVAILABLE, body };
  if (!canMessage(inquiry.status)) {
    return { error: "Messaging unlocks once the trader accepts the request.", body };
  }

  const valid = validateInquiryMessage(bodyRaw, "message");
  if (!valid.ok) return { error: valid.error, body };

  const limit = checkRateLimit(`inquiry:message:${userId}`, { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return { error: `You're sending messages quickly. Try again in ${retryMinutes(limit.retryAfterSeconds)}.`, body };
  }

  await prisma.inquiryMessage.create({
    data: { inquiryId: inquiry.id, senderId: userId, body: valid.value },
  });

  const href = `/inbox/${inquiry.id}`;
  const recipient = isClient ? inquiry.profile.userId : inquiry.clientId;
  const sender = isClient ? inquiry.client.name?.trim() || "your client contact" : inquiry.profile.displayName;
  await notify(recipient, "inquiry_message", `New message from ${sender}`, href, { collapse: true });

  revalidatePath(href);
  revalidatePath("/inbox");
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/* Notifications                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Mark what the viewer has seen as read (called when the Activity list or a
 * thread mounts). Always scoped to the session user.
 */
export async function markNotificationsSeen(input: { before?: string; href?: string }): Promise<number> {
  const userId = await optionalUserId();
  if (!userId || typeof input !== "object" || input === null) return 0;

  let href: string | undefined;
  if (input.href !== undefined) {
    // A malformed scope must not widen into "mark everything read".
    if (typeof input.href !== "string" || !/^\/inbox\/[A-Za-z0-9_-]{1,64}$/.test(input.href)) return 0;
    href = input.href;
  }
  let before: Date | undefined;
  if (input.before !== undefined) {
    before = typeof input.before === "string" ? new Date(input.before) : undefined;
    if (!before || Number.isNaN(before.getTime())) return 0;
  }
  const count = await markNotificationsRead(userId, { before, href });
  if (count > 0) refresh();
  return count;
}

/** "Mark all read" button (works without JavaScript). */
export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await markNotificationsRead(userId);
  revalidatePath("/inbox");
  refresh();
}
