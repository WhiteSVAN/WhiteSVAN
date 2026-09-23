/**
 * Trader profile analytics — pure math over ProfileView / Follow / Inquiry rows.
 * No DB access here; pages query the rows and pass them in. Every ratio returns
 * null (not NaN / Infinity) when its denominator is zero.
 */

export const ANALYTICS_WINDOWS = [30, 90] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];

/** `?days=` → a supported window (default 30). */
export function toAnalyticsWindow(raw: unknown): AnalyticsWindow {
  const n = Number(raw);
  return (ANALYTICS_WINDOWS as readonly number[]).includes(n) ? (n as AnalyticsWindow) : 30;
}

const DAY_MS = 86_400_000;

/** UTC midnight of the given instant (matches `@db.Date` columns). */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** First UTC day of a `days`-long window ending today (inclusive). */
export function windowStart(days: number, now: Date = new Date()): Date {
  return new Date(utcDay(now).getTime() - (Math.max(1, days) - 1) * DAY_MS);
}

function isoDay(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export interface ViewRow {
  day: Date | string;
  viewerKey: string;
  viewerId?: string | null;
}

export interface DailyViews {
  date: string; // YYYY-MM-DD
  views: number;
}

/**
 * Views per day across the window, oldest first, with zero-filled gaps. A "view"
 * is one (viewer, day) row — the table already dedupes repeat visits in a day.
 * Rows outside the window are ignored.
 */
export function viewsPerDay(rows: readonly ViewRow[], days: number, now: Date = new Date()): DailyViews[] {
  const start = windowStart(days, now).getTime();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = isoDay(r.day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: DailyViews[] = [];
  for (let i = 0; i < Math.max(1, days); i++) {
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    out.push({ date, views: counts.get(date) ?? 0 });
  }
  return out;
}

export interface ViewerSummary {
  /** Total (viewer, day) rows. */
  views: number;
  /** Distinct viewers across the window. */
  uniqueViewers: number;
  signedInViewers: number;
  anonymousViewers: number;
}

/** Signed-in viewers are keyed `u:<userId>` (see src/lib/profile-views.ts). */
export function isSignedInViewer(row: Pick<ViewRow, "viewerKey" | "viewerId">): boolean {
  return !!row.viewerId || row.viewerKey.startsWith("u:");
}

export function summarizeViewers(rows: readonly ViewRow[]): ViewerSummary {
  const signedIn = new Set<string>();
  const anonymous = new Set<string>();
  for (const r of rows) (isSignedInViewer(r) ? signedIn : anonymous).add(r.viewerKey);
  return {
    views: rows.length,
    uniqueViewers: signedIn.size + anonymous.size,
    signedInViewers: signedIn.size,
    anonymousViewers: anonymous.size,
  };
}

/** n ÷ d, or null when the denominator is zero / not finite. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export type InquiryStatusKey = "PENDING" | "ACCEPTED" | "DECLINED" | "IGNORED";

export interface InquirySummary {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  ignored: number;
  /** Requests the trader has acted on (accepted, declined or ignored). */
  responded: number;
  /** accepted ÷ responded — null until something has been answered. */
  acceptanceRate: number | null;
}

export function summarizeInquiries(rows: readonly { status: string }[]): InquirySummary {
  const count = (s: InquiryStatusKey) => rows.filter((r) => r.status === s).length;
  const pending = count("PENDING");
  const accepted = count("ACCEPTED");
  const declined = count("DECLINED");
  const ignored = count("IGNORED");
  const responded = accepted + declined + ignored;
  return {
    total: rows.length,
    pending,
    accepted,
    declined,
    ignored,
    responded,
    acceptanceRate: ratio(accepted, responded),
  };
}

/** Conversation requests per unique profile viewer — null without viewers. */
export function conversionRate(inquiries: number, uniqueViewers: number): number | null {
  return ratio(inquiries, uniqueViewers);
}

/** How many timestamps fall on or after `since`. */
export function countSince(dates: readonly Date[], since: Date): number {
  const t = since.getTime();
  return dates.filter((d) => d.getTime() >= t).length;
}

/** `0.125` → `12.5%`, null → `—`. */
export function formatRate(value: number | null, digits = 1): string {
  if (value == null) return "—";
  const pct = value * 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(digits)}%`;
}
