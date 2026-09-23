/**
 * Professional inquiries: pure state rules shared by the server actions in
 * src/app/(app)/inbox/actions.ts and the UI. Nothing here touches the database.
 *
 * An inquiry opens a *conversation*, never a mandate. Messaging unlocks only
 * once the trader accepts, and every request/message runs through the same
 * compliance + signal-language filter as posts.
 */
import { postLanguageIssues } from "@/lib/posts";

export const INQUIRY_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "IGNORED"] as const;
export type InquiryStatusKey = (typeof INQUIRY_STATUSES)[number];

/** Statuses that block a new request from the same client to the same profile. */
export const OPEN_STATUSES: readonly InquiryStatusKey[] = ["PENDING", "ACCEPTED"];
export const CLOSED_STATUSES: readonly InquiryStatusKey[] = ["DECLINED", "IGNORED"];

/** Days a client waits after a declined / ignored request before asking again. */
export const REQUEST_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REQUEST_MESSAGE_MIN = 20;
export const REQUEST_MESSAGE_MAX = 1000;
export const THREAD_MESSAGE_MIN = 1;
export const THREAD_MESSAGE_MAX = 2000;

export function isInquiryStatus(value: unknown): value is InquiryStatusKey {
  return typeof value === "string" && (INQUIRY_STATUSES as readonly string[]).includes(value);
}

const TRANSITIONS: Record<InquiryStatusKey, readonly InquiryStatusKey[]> = {
  PENDING: ["ACCEPTED", "DECLINED", "IGNORED"],
  // An ignored request can still be picked up later; a decline is final.
  IGNORED: ["ACCEPTED"],
  ACCEPTED: [],
  DECLINED: [],
};

/** Whether the trader may move an inquiry from `from` to `to`. */
export function canTransition(from: InquiryStatusKey, to: InquiryStatusKey): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Messaging is unlocked only for accepted inquiries. */
export function canMessage(status: InquiryStatusKey): boolean {
  return status === "ACCEPTED";
}

export interface InquiryHistoryEntry {
  status: InquiryStatusKey;
  createdAt: Date;
  respondedAt: Date | null;
}

/**
 * When the client may send a new request, given their most recent inquiry to
 * this profile. `null` = never (an open request exists); a date in the past or
 * `now` = allowed.
 */
export function requestAgainAt(latest: InquiryHistoryEntry | null): Date | null {
  if (!latest) return new Date(0);
  if (OPEN_STATUSES.includes(latest.status)) return null;
  const closedAt = latest.respondedAt ?? latest.createdAt;
  return new Date(closedAt.getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS);
}

/** Whether the client may send a new request now (see `requestAgainAt`). */
export function canRequestAgain(latest: InquiryHistoryEntry | null, now: Date): boolean {
  const at = requestAgainAt(latest);
  return at !== null && at.getTime() <= now.getTime();
}

export type MessageKind = "request" | "message";

export type MessageValidation = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate the free text of a conversation request ("request", 20–1000 chars)
 * or a thread message ("message", 1–2000 chars). Trims, normalizes line
 * endings, collapses runs of blank lines, and rejects banned / signal language.
 */
export function validateInquiryMessage(raw: unknown, kind: MessageKind): MessageValidation {
  const value = (typeof raw === "string" ? raw : "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const [min, max] =
    kind === "request"
      ? [REQUEST_MESSAGE_MIN, REQUEST_MESSAGE_MAX]
      : [THREAD_MESSAGE_MIN, THREAD_MESSAGE_MAX];

  if (value.length < min) {
    return {
      ok: false,
      error:
        kind === "request"
          ? `Add a short note about what you'd like to discuss (at least ${min} characters).`
          : "Write a message first.",
    };
  }
  if (value.length > max) {
    return { ok: false, error: `Keep it under ${max.toLocaleString("en-US")} characters.` };
  }
  const issues = postLanguageIssues(value);
  if (issues.length > 0) {
    return {
      ok: false,
      error:
        `Remove language that isn't allowed here: ${issues.join(", ")}. ` +
        "Conversations are for research and diligence — not signals, copy trading, or managing money.",
    };
  }
  return { ok: true, value };
}

export type Perspective = "client" | "trader";

/** Short status label, phrased for whoever is looking. */
export function inquiryStatusLabel(status: InquiryStatusKey, perspective: Perspective): string {
  if (perspective === "client") {
    switch (status) {
      case "PENDING":
        return "Request sent";
      case "ACCEPTED":
        return "Accepted";
      case "DECLINED":
        return "Declined";
      case "IGNORED":
        return "No response";
    }
  }
  switch (status) {
    case "PENDING":
      return "Awaiting your response";
    case "ACCEPTED":
      return "Active";
    case "DECLINED":
      return "Declined";
    case "IGNORED":
      return "Ignored";
  }
}

/** Map a trader's button choice to the status it sets. */
export const DECISIONS = {
  accept: "ACCEPTED",
  decline: "DECLINED",
  ignore: "IGNORED",
} as const satisfies Record<string, InquiryStatusKey>;
export type Decision = keyof typeof DECISIONS;

export function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && Object.hasOwn(DECISIONS, value);
}

/** Decisions available to the trader from the given status. */
export function availableDecisions(status: InquiryStatusKey): Decision[] {
  return (Object.keys(DECISIONS) as Decision[]).filter((d) => canTransition(status, DECISIONS[d]));
}

/**
 * Notification links must stay inside the app. Accepts only a single-slash
 * path; rejects protocol-relative ("//x"), backslash tricks ("/\x", which
 * browsers normalize to "//x"), and control characters.
 */
export function safeInternalHref(href: string | null | undefined): string | null {
  if (typeof href !== "string" || href.length === 0 || href.length > 512) return null;
  if (!href.startsWith("/") || href[1] === "/" || href[1] === "\\") return null;
  if (/[\\\u0000-\u001f\u007f]/.test(href)) return null;
  return href;
}
