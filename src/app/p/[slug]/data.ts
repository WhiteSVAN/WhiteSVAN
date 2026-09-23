/**
 * Data access for the public proof profile. Every loader here is keyed by the
 * profile id resolved from the slug *after* the visibility check in
 * `getViewableProfile`, so tab components never receive an id straight from
 * the URL. React `cache` dedupes calls within one render (metadata + page).
 */
import { cache } from "react";
import { prisma } from "@/lib/db";
import { optionalUserId } from "@/lib/auth/dal";
import { RECORD_VERSION_SELECT } from "@/lib/record-context";
import { hiddenSectionSet } from "@/lib/profile-page";

const PROFILE_SELECT = {
  id: true,
  userId: true,
  slug: true,
  displayName: true,
  bio: true,
  strategy: true,
  instruments: true,
  riskRules: true,
  disclaimer: true,
  isPublic: true,
  hideAmounts: true,
  hideBrokers: true,
  updateCadence: true,
  lastPublishedAt: true,
  openToWork: true,
  headline: true,
  services: true,
  contactUrl: true,
  experienceYears: true,
  markets: true,
  strategyTags: true,
  region: true,
  capitalBand: true,
  credentials: true,
  registrationType: true,
  registrationNumber: true,
  acceptInquiries: true,
  hiddenSections: true,
} as const;

export const getProfileBySlug = cache(async (slug: string) =>
  prisma.traderProfile.findUnique({ where: { slug }, select: PROFILE_SELECT }),
);

export type ProfileRecord = NonNullable<Awaited<ReturnType<typeof getProfileBySlug>>>;

export interface ViewableProfile {
  profile: ProfileRecord;
  viewerId: string | null;
  isOwner: boolean;
  hidden: ReturnType<typeof hiddenSectionSet>;
}

/**
 * The profile if the current viewer may see it: public profiles for everyone,
 * private profiles only for their owner (preview). Otherwise null.
 */
export const getViewableProfile = cache(async (slug: string): Promise<ViewableProfile | null> => {
  const [profile, viewerId] = await Promise.all([getProfileBySlug(slug), optionalUserId()]);
  if (!profile) return null;
  const isOwner = viewerId != null && viewerId === profile.userId;
  if (!profile.isPublic && !isOwner) return null;
  return { profile, viewerId, isOwner, hidden: hiddenSectionSet(profile.hiddenSections) };
});

const VERSION_SUMMARY_SELECT = {
  ...RECORD_VERSION_SELECT,
  netPnl: true,
  returnPct: true,
  changeSummary: true,
} as const;

export const getLatestVersion = cache(async (profileId: string) =>
  prisma.profileVersion.findFirst({
    where: { profileId },
    orderBy: { versionNumber: "desc" },
    select: VERSION_SUMMARY_SELECT,
  }),
);

export type VersionSummaryRow = NonNullable<Awaited<ReturnType<typeof getLatestVersion>>>;

/** Max drawdown (percent) per version id, read straight from the stored snapshot JSON. */
async function drawdownByVersion(profileId: string, versionId?: string): Promise<Map<string, number | null>> {
  const rows = versionId
    ? await prisma.$queryRaw<{ id: string; dd: number | null }[]>`
        SELECT "id",
          CASE WHEN jsonb_typeof("metrics"->'maxDrawdownPct') = 'number'
               THEN ("metrics"->>'maxDrawdownPct')::float8 END AS "dd"
        FROM "ProfileVersion" WHERE "profileId" = ${profileId} AND "id" = ${versionId}`
    : await prisma.$queryRaw<{ id: string; dd: number | null }[]>`
        SELECT "id",
          CASE WHEN jsonb_typeof("metrics"->'maxDrawdownPct') = 'number'
               THEN ("metrics"->>'maxDrawdownPct')::float8 END AS "dd"
        FROM "ProfileVersion" WHERE "profileId" = ${profileId}`;
  return new Map(rows.map((r) => [r.id, r.dd == null ? null : Number(r.dd)]));
}

export type VersionListRow = VersionSummaryRow & { maxDrawdownPct: number | null };

/** Every published version, newest first, without loading the heavy snapshot JSON. */
export async function getVersionList(profileId: string): Promise<VersionListRow[]> {
  const [rows, dd] = await Promise.all([
    prisma.profileVersion.findMany({
      where: { profileId },
      orderBy: { versionNumber: "desc" },
      select: VERSION_SUMMARY_SELECT,
    }),
    drawdownByVersion(profileId),
  ]);
  return rows.map((r) => ({ ...r, maxDrawdownPct: dd.get(r.id) ?? null }));
}

/** Latest version plus its stored max drawdown (for metadata and the share card). */
export async function getLatestVersionWithDrawdown(profileId: string): Promise<VersionListRow | null> {
  const latest = await getLatestVersion(profileId);
  if (!latest) return null;
  const dd = await drawdownByVersion(profileId, latest.id);
  return { ...latest, maxDrawdownPct: dd.get(latest.id) ?? null };
}

/** One version's full stored snapshot (metrics JSON included). */
export async function getVersionSnapshot(profileId: string, versionNumber: number) {
  return prisma.profileVersion.findUnique({
    where: { profileId_versionNumber: { profileId, versionNumber } },
    select: { ...VERSION_SUMMARY_SELECT, metrics: true },
  });
}

/** Most recent source import across the trader's accounts. */
export const getLatestImport = cache(async (userId: string) =>
  prisma.importBatch.findFirst({
    where: { account: { userId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, periodEnd: true },
  }),
);

export const IMPORT_HISTORY_LIMIT = 50;

export async function getImportHistory(userId: string) {
  const where = { account: { userId } };
  const [count, batches, first] = await Promise.all([
    prisma.importBatch.count({ where }),
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: IMPORT_HISTORY_LIMIT,
      select: {
        id: true,
        source: true,
        broker: true,
        rowCount: true,
        fileHash: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
      },
    }),
    prisma.importBatch.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  return { count, batches, firstImportAt: first?.createdAt ?? null };
}

/** Account + broker labels, used only to redact prose when the trader hides brokers. */
export const getPrivateTerms = cache(async (userId: string): Promise<string[]> => {
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: { accountName: true, broker: true },
  });
  return accounts.flatMap((a) => [a.accountName, a.broker ?? ""]).filter((t) => t.trim().length >= 2);
});

/** Follow count (public) + the viewer's own follow / watchlist state (private). */
export async function getFollowState(profileId: string, viewerId: string | null) {
  const [followerCount, follow, watch] = await Promise.all([
    prisma.follow.count({ where: { profileId } }),
    viewerId
      ? prisma.follow.findUnique({
          where: { userId_profileId: { userId: viewerId, profileId } },
          select: { userId: true },
        })
      : null,
    viewerId
      ? prisma.watchlistItem.findUnique({
          where: { userId_profileId: { userId: viewerId, profileId } },
          select: { userId: true },
        })
      : null,
  ]);
  return { followerCount, following: !!follow, watching: !!watch };
}
