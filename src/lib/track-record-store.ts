/**
 * Track records on the server: a tracked journal account's synced days and open positions, run
 * through the pure review in src/lib/track-record.ts. The trader's page and the staff shortlist
 * both load through here, so they always show the same verdict.
 */
import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/format";
import { findAccountPlan, type EvaluationPlan } from "@/lib/prop-firm";
import { reviewTrackRecord, type TrackReview } from "@/lib/track-record";
import { toPaise } from "@/lib/trading/money";

export interface TrackedAccountRef {
  id: string;
  trackPlanId: string | null;
  trackStart: Date | null;
}

export interface TrackSummary {
  plan: EvaluationPlan;
  /** First IST date counted. */
  start: string | null;
  review: TrackReview;
  /** Every synced day from the start, in rupees (for the calendar). */
  days: { date: string; netPnl: number }[];
  /** Last trading date covered by a synced tradebook. */
  syncedThrough: string | null;
}

export async function loadTrackSummary(account: TrackedAccountRef): Promise<TrackSummary | null> {
  const plan = account.trackPlanId ? findAccountPlan(account.trackPlanId) : undefined;
  if (!plan) return null;
  const from = account.trackStart;
  const [daily, batches] = await Promise.all([
    prisma.dailyPnl.findMany({
      where: { accountId: account.id, ...(from ? { tradeDate: { gte: from } } : {}) },
      select: { tradeDate: true, netPnl: true },
      orderBy: { tradeDate: "asc" },
    }),
    // Files that end before the start can't affect the record, open positions included.
    prisma.importBatch.findMany({
      where: { accountId: account.id, ...(from ? { OR: [{ periodEnd: null }, { periodEnd: { gte: from } }] } : {}) },
      select: { openPositions: true, periodEnd: true },
    }),
  ]);

  const start = from ? toISODate(from) : null;
  const days = daily.map((day) => ({ date: toISODate(day.tradeDate), netPnl: Number(day.netPnl) }));
  const openPositions = batches.reduce((sum, batch) => sum + batch.openPositions, 0);
  const syncedThrough = batches.reduce<string | null>((last, batch) => {
    const end = batch.periodEnd ? toISODate(batch.periodEnd) : null;
    return end && (!last || end > last) ? end : last;
  }, null);
  const review = reviewTrackRecord(plan, days.map((day) => ({ date: day.date, net: toPaise(day.netPnl) })), { start, openPositions });
  return { plan, start, review, days, syncedThrough };
}
