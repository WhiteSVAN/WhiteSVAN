/**
 * Server-side loader for a trader's profile analytics. Callers must already have
 * authorized the viewer as the owner of `profileId` (requireTrader()). The math
 * lives in src/lib/analytics.ts; this only fetches rows.
 */
import { prisma } from "@/lib/db";
import {
  conversionRate,
  summarizeInquiries,
  summarizeViewers,
  viewsPerDay,
  windowStart,
  type AnalyticsWindow,
  type DailyViews,
  type InquirySummary,
  type ViewerSummary,
} from "@/lib/analytics";

export interface ProfileAnalytics {
  days: AnalyticsWindow;
  since: Date;
  series: DailyViews[];
  viewers: ViewerSummary;
  followers: { total: number; inWindow: number };
  inquiries: InquirySummary;
  /** Requests received ÷ unique viewers in the window (null without viewers). */
  conversion: number | null;
}

export async function loadProfileAnalytics(
  profileId: string,
  days: AnalyticsWindow,
  now: Date = new Date(),
): Promise<ProfileAnalytics> {
  const since = windowStart(days, now);
  const [views, followerTotal, followersInWindow, inquiries] = await Promise.all([
    prisma.profileView.findMany({
      where: { profileId, day: { gte: since } },
      select: { day: true, viewerKey: true, viewerId: true },
    }),
    prisma.follow.count({ where: { profileId } }),
    prisma.follow.count({ where: { profileId, createdAt: { gte: since } } }),
    prisma.inquiry.findMany({
      where: { profileId, createdAt: { gte: since } },
      select: { status: true },
    }),
  ]);

  const viewers = summarizeViewers(views);
  const inquirySummary = summarizeInquiries(inquiries);
  return {
    days,
    since,
    series: viewsPerDay(views, days, now),
    viewers,
    followers: { total: followerTotal, inWindow: followersInWindow },
    inquiries: inquirySummary,
    conversion: conversionRate(inquirySummary.total, viewers.uniqueViewers),
  };
}
