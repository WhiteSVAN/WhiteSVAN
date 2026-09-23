/**
 * Factual record context for a trader: where their latest published record came
 * from, what window it covers, and when it was last updated. This is what sits
 * beside a trader's name everywhere (directory cards, posts, community rosters)
 * instead of a score.
 */
import { differenceInCalendarMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";
import { toISODate } from "@/lib/format";

export interface RecordContext {
  versionId: string;
  versionNumber: number;
  /** Factual source label, e.g. "Imported trading history". */
  source: string;
  /** Whether anyone independent has reviewed the record. */
  reviewStatus: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  /** Months covered, inclusive (null without a coverage window). */
  months: number | null;
  publishedAt: string;
  isBrokerApi: boolean;
}

type VersionRow = {
  id: string;
  versionNumber: number;
  proofLevel: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  publishedAt: Date;
  sourceBatch: { source: string } | null;
};

export function toRecordContext(v: VersionRow): RecordContext {
  const level = (v.proofLevel >= 1 && v.proofLevel <= 5 ? v.proofLevel : 2) as ProofLevel;
  const isBrokerApi = v.sourceBatch?.source === "BROKER_API";
  return {
    versionId: v.id,
    versionNumber: v.versionNumber,
    source: isBrokerApi ? "Direct broker connection" : PROOF_LEVELS[level].label,
    reviewStatus: level >= 5 ? "Independently reviewed" : "Not independently reviewed",
    coverageStart: v.periodStart ? toISODate(v.periodStart) : null,
    coverageEnd: v.periodEnd ? toISODate(v.periodEnd) : null,
    months:
      v.periodStart && v.periodEnd
        ? Math.max(1, differenceInCalendarMonths(v.periodEnd, v.periodStart) + 1)
        : null,
    publishedAt: v.publishedAt.toISOString(),
    isBrokerApi,
  };
}

export const RECORD_VERSION_SELECT = {
  id: true,
  versionNumber: true,
  proofLevel: true,
  periodStart: true,
  periodEnd: true,
  publishedAt: true,
  sourceBatch: { select: { source: true } },
} as const;

/** Latest published record context per trader user id (public profiles only). */
export async function recordContextByUser(userIds: string[]): Promise<Map<string, RecordContext & { slug: string }>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const profiles = await prisma.traderProfile.findMany({
    where: { userId: { in: ids }, isPublic: true },
    select: {
      userId: true,
      slug: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: RECORD_VERSION_SELECT },
    },
  });
  const out = new Map<string, RecordContext & { slug: string }>();
  for (const p of profiles) {
    const v = p.versions[0];
    if (v) out.set(p.userId, { ...toRecordContext(v), slug: p.slug });
  }
  return out;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Jan 2025 – Aug 2026" */
export function coverageLabel(ctx: Pick<RecordContext, "coverageStart" | "coverageEnd">): string {
  if (!ctx.coverageStart || !ctx.coverageEnd) return "Coverage unavailable";
  const a = MONTH_FMT.format(new Date(`${ctx.coverageStart}T00:00:00Z`));
  const b = MONTH_FMT.format(new Date(`${ctx.coverageEnd}T00:00:00Z`));
  return a === b ? a : `${a} – ${b}`;
}
