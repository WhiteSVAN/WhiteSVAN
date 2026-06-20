"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeTrustMetrics } from "@/lib/trust";
import { accountProofLevel } from "@/lib/proof";
import { toISODate } from "@/lib/format";
import {
  getFreshnessStatus,
  toCadence,
  reliabilityFromFreshness,
  type FreshnessStatus,
} from "@/lib/freshness";
import { diffVersions, type VersionSnapshot } from "@/lib/version";
import { generateRiskEvents, buildChangeSummary } from "@/lib/risk-events";

export type PublishState = { published?: boolean; version?: number; error?: string } | undefined;

/**
 * Publish a profile update: snapshot the current trust metrics into a new
 * immutable `ProfileVersion`, generate + persist risk events, store the
 * plain-English change summary, stamp `lastPublishedAt` (drives freshness), and
 * queue notifications for active followers. Never mutates prior versions.
 */
export async function publishUpdate(
  _prev: PublishState,
  _formData: FormData,
): Promise<PublishState> {
  void _prev;
  void _formData;

  const user = await requireUser();
  if (!user.profile) return { error: "Set up your profile first." };

  // Primary account = the portal's headline account (earliest created).
  const account = await prisma.tradingAccount.findFirst({
    where: { userId: user.id },
    select: { id: true, startingBalance: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) return { error: "Add an account and import trades before publishing." };

  const dayRows = await prisma.dailyPnl.findMany({
    where: { accountId: account.id },
    select: { tradeDate: true, netPnl: true },
    orderBy: { tradeDate: "asc" },
  });
  if (dayRows.length === 0) return { error: "No trades to publish yet." };

  const dailySeries = dayRows.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const proofLevel = await accountProofLevel(account.id, true);

  // Publishing now → the profile is fresh for its cadence; that drives reliability.
  const now = new Date();
  const cadence = toCadence(user.profile.updateCadence);
  const freshness: FreshnessStatus = getFreshnessStatus(cadence, now, now);
  const trust = computeTrustMetrics(
    dailySeries,
    Number(account.startingBalance),
    proofLevel,
    reliabilityFromFreshness(freshness),
  );

  const periodStart = dailySeries[0].date;
  const periodEnd = dailySeries[dailySeries.length - 1].date;

  // Previous version → diff → change summary + risk events.
  const latest = await prisma.profileVersion.findFirst({
    where: { profileId: user.profile.id },
    orderBy: { versionNumber: "desc" },
    select: {
      versionNumber: true,
      netPnl: true,
      returnPct: true,
      transparencyScore: true,
      proofLevel: true,
      periodEnd: true,
      metrics: true,
    },
  });

  const prevSnap: VersionSnapshot | null = latest
    ? {
        netPnl: Number(latest.netPnl),
        returnPct: latest.returnPct,
        transparencyScore: latest.transparencyScore,
        proofLevel: latest.proofLevel,
        maxDrawdownPct:
          (latest.metrics as { maxDrawdownPct?: number } | null)?.maxDrawdownPct ?? 0,
        periodEnd: latest.periodEnd ? toISODate(latest.periodEnd) : null,
      }
    : null;
  const nextSnap: VersionSnapshot = {
    netPnl: trust.metrics.netPnl,
    returnPct: trust.metrics.returnPct,
    transparencyScore: trust.scores.transparency,
    proofLevel,
    maxDrawdownPct: trust.metrics.maxDrawdownPct,
    periodEnd,
  };
  const diff = diffVersions(prevSnap, nextSnap);
  const changeSummary = buildChangeSummary(trust, diff);
  const events = generateRiskEvents(trust, diff, freshness);
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const sourceBatch = await prisma.importBatch.findFirst({
    where: { account: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // Flattened, plain-value snapshot (like Report.metrics) — reproducible record.
  const metricsSnapshot = JSON.parse(
    JSON.stringify({
      ...trust.metrics,
      bestDayShare: trust.bestDayShare,
      top3Share: trust.top3Share,
      profitWithoutBestDay: trust.profitWithoutBestDay,
      badToGoodRatio: trust.badToGoodRatio,
      drawdownSeverity: trust.drawdownSeverity,
      bounceBackDays: trust.bounceBackDays,
      daysUnderwater: trust.daysUnderwater,
      proofLevel,
      scores: trust.scores,
      verdict: trust.verdict,
    }),
  );

  const followers = await prisma.profileFollower.findMany({
    where: { profileId: user.profile.id, status: "ACTIVE" },
    select: { id: true },
  });
  const hasRiskChange = events.some((e) => e.severity !== "INFO");

  const profileId = user.profile.id;
  const displayName = user.profile.displayName;

  await prisma.$transaction(async (tx) => {
    const version = await tx.profileVersion.create({
      data: {
        profileId,
        versionNumber,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        metrics: metricsSnapshot,
        netPnl: trust.metrics.netPnl,
        returnPct: trust.metrics.returnPct,
        transparencyScore: trust.scores.transparency,
        proofLevel,
        freshnessStatus: freshness,
        changeSummary,
        sourceBatchId: sourceBatch?.id ?? null,
      },
      select: { id: true },
    });

    if (events.length > 0) {
      await tx.riskEvent.createMany({
        data: events.map((e) => ({
          profileId,
          versionId: version.id,
          type: e.type,
          severity: e.severity,
          title: e.title,
          description: e.description,
          metricBefore: e.metricBefore ?? null,
          metricAfter: e.metricAfter ?? null,
          isClientVisible: e.isClientVisible,
        })),
      });
    }

    await tx.traderProfile.update({
      where: { id: profileId },
      data: { lastPublishedAt: now },
    });

    if (followers.length > 0) {
      await tx.notificationEvent.createMany({
        data: followers.map((f) => ({
          profileId,
          followerId: f.id,
          type: hasRiskChange ? ("RISK_CHANGE" as const) : ("WEEKLY_UPDATE" as const),
          subject: `${displayName} published an update (v${versionNumber})`,
          body: changeSummary,
        })),
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath(`/p/${user.profile.slug}`);
  return { published: true, version: versionNumber };
}
