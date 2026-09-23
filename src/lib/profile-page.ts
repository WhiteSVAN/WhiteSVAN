/**
 * Pure helpers for the public proof profile (/p/[slug]) and its share card.
 * No Prisma, no React — everything here is unit-tested in profile-page.test.ts.
 *
 * The profile shows facts about a published record: where it came from, what
 * window it covers, when it was published, and what the trader chose to hide.
 * Nothing here ranks, scores, or recommends.
 */
import { PROFILE_SECTIONS } from "@/lib/profile-options";
import type { CoverageGap } from "@/lib/coverage";

// ─── Tabs ────────────────────────────────────────────────────

export const PROFILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "performance", label: "Performance" },
  { key: "proof", label: "Proof history" },
  { key: "posts", label: "Posts" },
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number]["key"];

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?tab=` → a known tab; anything else falls back to the overview. */
export function parseTab(value: SearchValue): ProfileTab {
  const raw = firstValue(value);
  return PROFILE_TABS.some((t) => t.key === raw) ? (raw as ProfileTab) : "overview";
}

/** `?v=` → a positive version number, or null for "latest". */
export function parseVersionParam(value: SearchValue): number | null {
  const raw = firstValue(value)?.trim();
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

/** Canonical link to a profile tab (overview has no query string). */
export function profileHref(slug: string, tab: ProfileTab = "overview", version?: number | null): string {
  const base = `/p/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (tab === "proof" && version != null) params.set("v", String(version));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Section privacy ─────────────────────────────────────────

export type ProfileSection =
  | "performance"
  | "calendar"
  | "history"
  | "evidence"
  | "posts"
  | "briefs"
  | "credentials";

const SECTION_KEYS = new Set(PROFILE_SECTIONS.map((s) => s.key));

/** The trader's hidden sections, keeping only keys the profile knows about. */
export function hiddenSectionSet(hidden: readonly string[] | null | undefined): ReadonlySet<ProfileSection> {
  return new Set((hidden ?? []).filter((k): k is ProfileSection => SECTION_KEYS.has(k)));
}

// ─── Dates & labels ──────────────────────────────────────────

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
}

/** "Sep 1, 2026" (UTC, so `@db.Date` columns never shift a day). */
export function formatDay(value: string | Date): string {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "Unknown date" : DAY_FMT.format(d);
}

/** "Jan 3, 2025 – Aug 29, 2026", or a fallback when the window is unknown. */
export function coverageRange(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  if (!start || !end) return "Coverage unavailable";
  const a = formatDay(start);
  const b = formatDay(end);
  return a === b ? a : `${a} – ${b}`;
}

/** "8 yrs trading" / "1 yr trading" / null. */
export function yearsTradingLabel(years: number | null | undefined): string | null {
  if (years == null || !Number.isFinite(years) || years < 0) return null;
  if (years === 0) return "Under 1 yr trading";
  return `${years} yr${years === 1 ? "" : "s"} trading`;
}

/**
 * The provenance line that sits beside every published metric:
 * "Computed from Imported trading history · Jan 3, 2025 – Aug 29, 2026 · version 4 published Sep 1, 2026".
 */
export function provenanceLine(input: {
  source: string;
  coverageStart: string | Date | null;
  coverageEnd: string | Date | null;
  versionNumber: number;
  publishedAt: string | Date;
}): string {
  return [
    `Computed from ${input.source}`,
    coverageRange(input.coverageStart, input.coverageEnd),
    `version ${input.versionNumber} published ${formatDay(input.publishedAt)}`,
  ].join(" · ");
}

// ─── Figures ─────────────────────────────────────────────────

/** Fraction → "+12.3%" / "-4.0%". */
export function formatSignedPercent(fraction: number, digits = 1): string {
  const pct = fraction * 100;
  const text = Math.abs(pct).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%`;
  return `${pct > 0 ? "+" : "-"}${text}%`;
}

/**
 * Period return and max drawdown, always as a pair. A return is never shown
 * alone: when either figure is unknown (no starting balance → no percentages)
 * or the trader hid performance, neither is shown.
 */
export function pairedFigures(input: {
  performanceHidden: boolean;
  returnPct: number | null | undefined;
  maxDrawdownPct: number | null | undefined;
}): { periodReturn: string; maxDrawdown: string } | null {
  if (input.performanceHidden) return null;
  const { returnPct, maxDrawdownPct } = input;
  if (returnPct == null || !Number.isFinite(returnPct)) return null;
  if (maxDrawdownPct == null || !Number.isFinite(maxDrawdownPct)) return null;
  return {
    periodReturn: formatSignedPercent(returnPct, 1),
    maxDrawdown: `${Math.abs(maxDrawdownPct).toFixed(1)}%`,
  };
}

// ─── Coverage gaps ───────────────────────────────────────────

/** "No coverage gaps over 10 days" / "2 gaps · 45 days without records". */
export function gapSummary(gaps: readonly CoverageGap[], minGapDays = 10): string {
  if (gaps.length === 0) return `No gaps longer than ${minGapDays} days between recorded trading days`;
  const days = gaps.reduce((sum, g) => sum + g.days, 0);
  return `${gaps.length} gap${gaps.length === 1 ? "" : "s"} · ${days} calendar day${days === 1 ? "" : "s"} without records`;
}

// ─── Import history ──────────────────────────────────────────

const IMPORT_SOURCE_LABEL: Record<string, string> = {
  CSV: "File import",
  STATEMENT: "Statement import",
  BROKER_API: "Direct broker connection",
  MANUAL: "Manual entry",
};

export function importSourceLabel(source: string): string {
  return IMPORT_SOURCE_LABEL[source] ?? "Import";
}

/** First `n` hex chars of a sha-256 — enough to match a file without exposing it. */
export function hashPrefix(hash: string | null | undefined, n = 12): string {
  const clean = (hash ?? "").trim().toLowerCase();
  return /^[0-9a-f]+$/.test(clean) ? clean.slice(0, n) : "unavailable";
}

export interface ImportBatchInput {
  id: string;
  source: string;
  broker: string | null;
  rowCount: number;
  fileHash: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}

export interface ImportRow {
  id: string;
  importedAt: string;
  source: string;
  /** Null when the trader hides broker names. */
  broker: string | null;
  rows: number;
  period: string;
  hashPrefix: string;
}

/**
 * Public import-history rows. Original filenames are never exposed (they often
 * embed account numbers); broker names only when the trader allows it.
 */
export function importRows(batches: readonly ImportBatchInput[], opts: { hideBrokers: boolean }): ImportRow[] {
  return [...batches]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((b) => ({
      id: b.id,
      importedAt: formatDay(b.createdAt),
      source: importSourceLabel(b.source),
      broker: opts.hideBrokers ? null : b.broker?.trim() || null,
      rows: b.rowCount,
      period: coverageRange(b.periodStart, b.periodEnd),
      hashPrefix: hashPrefix(b.fileHash),
    }));
}

// ─── Metadata & share card ───────────────────────────────────

/** Collapse whitespace and cut to `max` chars on a word boundary with an ellipsis. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:·–-]+$/, "")}…`;
}

/** Meta description: headline (or strategy), then the record's source and coverage. */
export function profileDescription(input: {
  displayName: string;
  headline: string | null | undefined;
  strategy: string | null | undefined;
  source: string | null;
  coverage: string | null;
}): string {
  const lead = input.headline?.trim() || input.strategy?.trim() || `${input.displayName}'s trading record`;
  const record =
    input.source && input.coverage
      ? `Published record: ${input.source}, ${input.coverage}.`
      : "No published record yet.";
  return truncate(`${lead.replace(/[.\s]+$/, "")}. ${record} Research profile on TrustSVAN.`, 200);
}

/**
 * The site origin for canonical URLs and share images. A configured URL wins,
 * then the Vercel production host, then the request's own host.
 */
export function resolveSiteOrigin(input: {
  configured?: string | null;
  vercelProductionHost?: string | null;
  host?: string | null;
  proto?: string | null;
}): string | null {
  const fromUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
    } catch {
      return null;
    }
  };
  const configured = fromUrl(input.configured);
  if (configured) return configured;
  const vercel = input.vercelProductionHost?.trim();
  if (vercel) {
    const origin = fromUrl(`https://${vercel.replace(/^https?:\/\//, "")}`);
    if (origin) return origin;
  }
  const host = input.host?.split(",")[0]?.trim();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;
  const proto = input.proto?.split(",")[0]?.trim().toLowerCase();
  const scheme = proto === "http" || proto === "https" ? proto : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  return fromUrl(`${scheme}://${host}`);
}

/** Only http(s) and mailto links are rendered from trader-supplied contact URLs. */
export function safeExternalHref(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? url.href : null;
  } catch {
    return null;
  }
}
