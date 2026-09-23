/**
 * Directory data: every public trader profile with its structured identity and
 * factual record context. Sorting defaults to most recently updated — never by
 * return or score.
 */
import { prisma } from "@/lib/db";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { RECORD_VERSION_SELECT, toRecordContext, type RecordContext } from "@/lib/record-context";

export interface DirectoryTrader {
  profileId: string;
  slug: string;
  displayName: string;
  headline: string | null;
  strategy: string | null;
  markets: string[];
  strategyTags: string[];
  region: string | null;
  capitalBand: string | null;
  experienceYears: number | null;
  /** Null when the trader hides their credentials section. */
  registrationType: string | null;
  /** The trader hides credentials & registration on their public profile. */
  credentialsHidden: boolean;
  acceptInquiries: boolean;
  followerCount: number;
  record: RecordContext | null;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  /** Latest activity: record publish or profile edit (ISO). */
  lastActive: string;
  following: boolean;
  watching: boolean;
  /** The viewer owns this profile (hide Follow on their own card). */
  isOwner: boolean;
}

export async function loadDirectory(viewerId: string | null): Promise<DirectoryTrader[]> {
  const profiles = await prisma.traderProfile.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      userId: true,
      slug: true,
      displayName: true,
      headline: true,
      strategy: true,
      markets: true,
      strategyTags: true,
      region: true,
      capitalBand: true,
      experienceYears: true,
      registrationType: true,
      acceptInquiries: true,
      hiddenSections: true,
      updatedAt: true,
      _count: { select: { userFollows: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { ...RECORD_VERSION_SELECT, metrics: true },
      },
    },
  });

  const [follows, watches] = viewerId
    ? await Promise.all([
        prisma.follow.findMany({ where: { userId: viewerId }, select: { profileId: true } }),
        prisma.watchlistItem.findMany({ where: { userId: viewerId }, select: { profileId: true } }),
      ])
    : [[], []];
  const followSet = new Set(follows.map((f) => f.profileId));
  const watchSet = new Set(watches.map((w) => w.profileId));

  return profiles
    .map((p) => {
      const v = p.versions[0];
      const showPerformance = !p.hiddenSections.includes("performance");
      const trust = v && showPerformance ? publishedTrustFromMetrics(v.metrics)?.trust : null;
      const lastActive = v && v.publishedAt > p.updatedAt ? v.publishedAt : p.updatedAt;
      return {
        profileId: p.id,
        slug: p.slug,
        displayName: p.displayName,
        headline: p.headline,
        strategy: p.strategy,
        markets: p.markets,
        strategyTags: p.strategyTags,
        region: p.region,
        capitalBand: p.capitalBand,
        experienceYears: p.experienceYears,
        registrationType: p.hiddenSections.includes("credentials") ? null : p.registrationType,
        credentialsHidden: p.hiddenSections.includes("credentials"),
        acceptInquiries: p.acceptInquiries,
        followerCount: p._count.userFollows,
        record: v ? toRecordContext(v) : null,
        returnPct: trust?.metrics.returnPct ?? null,
        maxDrawdownPct: trust?.metrics.maxDrawdownPct ?? null,
        lastActive: lastActive.toISOString(),
        following: followSet.has(p.id),
        watching: watchSet.has(p.id),
        isOwner: viewerId !== null && p.userId === viewerId,
      };
    })
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}
