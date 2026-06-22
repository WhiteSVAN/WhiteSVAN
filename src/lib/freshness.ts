/**
 * Profile freshness — the "is this trust profile still current?" core.
 *
 * Pure, framework-agnostic functions (no Prisma, no React). A profile commits to
 * an update cadence; freshness compares how long ago it was last published
 * against that cadence's window. The UI only *renders* what these return.
 *
 * Thresholds follow the MVP2 brief:
 *   daily   — fresh ≤ 48h,  getting-stale ≤ 7d,  else stale
 *   weekly  — fresh ≤ 9d,   getting-stale ≤ 14d, else stale
 *   monthly — fresh ≤ 40d,  getting-stale ≤ 60d, else stale
 *   manual  — no commitment → `manual_only`
 */

/** Lowercase cadence used throughout this lib (maps from the Prisma `UpdateCadence`). */
export type Cadence = "daily" | "weekly" | "monthly" | "manual";

export type FreshnessStatus = "fresh" | "getting_stale" | "stale" | "manual_only" | "never";

const HOUR_MS = 3_600_000;

/** Per-cadence windows, in hours. `interval` is the nominal "next update due" gap. */
const WINDOWS: Record<Exclude<Cadence, "manual">, { fresh: number; gettingStale: number; interval: number }> = {
  daily: { fresh: 48, gettingStale: 168, interval: 24 }, // 48h / 7d
  weekly: { fresh: 216, gettingStale: 336, interval: 24 * 7 }, // 9d / 14d
  monthly: { fresh: 960, gettingStale: 1440, interval: 24 * 30 }, // 40d / 60d
};

/** Normalize the Prisma enum value (or any string) to a lowercase `Cadence`. */
export function toCadence(value: string | null | undefined): Cadence {
  switch ((value ?? "").toUpperCase()) {
    case "DAILY":
      return "daily";
    case "WEEKLY":
      return "weekly";
    case "MONTHLY":
      return "monthly";
    default:
      return "manual";
  }
}

/** Classify a profile's freshness for its chosen cadence. */
export function getFreshnessStatus(
  cadence: Cadence,
  lastPublishedAt: Date | null,
  now: Date = new Date(),
): FreshnessStatus {
  if (cadence === "manual") return "manual_only";
  if (!lastPublishedAt) return "never";

  const ageHours = (now.getTime() - lastPublishedAt.getTime()) / HOUR_MS;
  const w = WINDOWS[cadence];
  if (ageHours <= w.fresh) return "fresh";
  if (ageHours <= w.gettingStale) return "getting_stale";
  return "stale";
}

/** When the next update is nominally due — `null` for manual or never-published. */
export function nextExpectedUpdate(cadence: Cadence, lastPublishedAt: Date | null): Date | null {
  if (cadence === "manual" || !lastPublishedAt) return null;
  return new Date(lastPublishedAt.getTime() + WINDOWS[cadence].interval * HOUR_MS);
}

/**
 * Update-reliability score (0..100): share of expected updates actually made.
 * Returns 50 (neutral) when no updates were expected yet. Feeds Trust Score v2.
 */
export function calculateUpdateReliability(expectedUpdates: number, completedUpdates: number): number {
  if (expectedUpdates <= 0) return 50;
  return Math.round(Math.min(100, (completedUpdates / expectedUpdates) * 100));
}

/**
 * Map a freshness status to a reporting-discipline score (0..100) for the
 * Quantidive Score v2 "update reliability" factor. Manual/never sit at neutral-ish.
 */
export function reliabilityFromFreshness(status: FreshnessStatus): number {
  switch (status) {
    case "fresh":
      return 100;
    case "getting_stale":
      return 60;
    case "stale":
      return 20;
    case "manual_only":
      return 50;
    case "never":
      return 40;
  }
}

export type FreshnessTone = "good" | "warn" | "bad" | "neutral";

export interface FreshnessDisplay {
  label: string;
  /** Client-facing meaning, plain English. */
  blurb: string;
  tone: FreshnessTone;
}

/** Badge label + client-facing meaning + tone for a freshness status. */
export function freshnessLabel(status: FreshnessStatus): FreshnessDisplay {
  switch (status) {
    case "fresh":
      return { label: "Fresh", blurb: "Profile is current for its chosen reporting cadence.", tone: "good" };
    case "getting_stale":
      return { label: "Getting stale", blurb: "Trader is beginning to miss expected updates.", tone: "warn" };
    case "stale":
      return { label: "Stale", blurb: "Profile is outdated — treat results as historical only.", tone: "bad" };
    case "manual_only":
      return { label: "Manual updates", blurb: "Trader updates on no fixed schedule.", tone: "neutral" };
    case "never":
      return { label: "Not published yet", blurb: "No data has been published to this profile yet.", tone: "neutral" };
  }
}

const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  manual: "Manual",
};

/** Human label for a cadence ("Daily", "Weekly", …). */
export function cadenceLabel(cadence: Cadence): string {
  return CADENCE_LABEL[cadence];
}

export interface FreshnessSummary extends FreshnessDisplay {
  status: FreshnessStatus;
  /** Hours since last publish; `null` when never published. */
  ageHours: number | null;
  nextExpectedUpdate: Date | null;
}

/** One-call bundle for the UI: status + label + tone + age + next-due. */
export function describeFreshness(
  cadence: Cadence,
  lastPublishedAt: Date | null,
  now: Date = new Date(),
): FreshnessSummary {
  const status = getFreshnessStatus(cadence, lastPublishedAt, now);
  const ageHours = lastPublishedAt ? (now.getTime() - lastPublishedAt.getTime()) / HOUR_MS : null;
  return {
    status,
    ...freshnessLabel(status),
    ageHours,
    nextExpectedUpdate: nextExpectedUpdate(cadence, lastPublishedAt),
  };
}
