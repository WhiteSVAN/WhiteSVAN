/**
 * Pure discovery logic for /explore: URL <-> filter state, client-preference
 * prefill, filtering, and sorting. Client-safe (no server imports), so the
 * directory can filter instantly in the browser and keep the URL shareable.
 *
 * Guardrail: sorting is by recency, record length, or name — NEVER by return,
 * drawdown, or any score. Returns are context on a card, not a ranking key.
 */
import type { DirectoryTrader } from "@/lib/directory";
import type { RecordContext } from "@/lib/record-context";
import { optionLabels, pickKey, pickKeys, type Option } from "@/lib/profile-options";

export type DirectoryTab = "all" | "following" | "watchlist";
export type DirectorySort = "recent" | "record" | "name";

export interface DirectoryFilters {
  /** Free text over name, headline, and strategy. */
  q: string;
  /** Any-of: trader lists at least one of these markets. */
  markets: string[];
  /** Any-of: trader lists at least one of these strategy tags. */
  strategyTags: string[];
  /** Any-of: trader's region is one of these. */
  regions: string[];
  capitalBand: string | null;
  /** Key from RECORD_SOURCES (matched against RecordContext.source). */
  source: string | null;
  /** Minimum months of published record coverage; 0 = any. */
  minMonths: number;
  /** Minimum self-declared years of experience; 0 = any. */
  minExperience: number;
  /** Only traders accepting conversation requests. */
  accepting: boolean;
  /** Only traders who declared a regulatory registration (self-declared). */
  registered: boolean;
}

export interface DirectoryView {
  filters: DirectoryFilters;
  sort: DirectorySort;
  tab: DirectoryTab;
  /** The viewer explicitly turned their saved client preferences off. */
  prefsOff: boolean;
}

/** The directory fields the filters and sorts read. */
export type FilterableTrader = Pick<
  DirectoryTrader,
  | "displayName"
  | "headline"
  | "strategy"
  | "markets"
  | "strategyTags"
  | "region"
  | "capitalBand"
  | "experienceYears"
  | "registrationType"
  | "acceptInquiries"
  | "lastActive"
  | "following"
  | "watching"
> & { record: Pick<RecordContext, "source" | "months"> | null };

/** What a signed-in client said they are looking for (ClientProfile). */
export interface ClientPreferences {
  markets: string[];
  regions: string[];
  strategyTags: string[];
}

/**
 * Record sources, keyed for the URL. Labels must equal the values
 * `toRecordContext` produces for `RecordContext.source` (tested).
 */
export const RECORD_SOURCES: Option[] = [
  { key: "broker", label: "Direct broker connection" },
  { key: "imported", label: "Imported trading history" },
  { key: "statement", label: "Statement attached" },
  { key: "document", label: "Additional document attached" },
  { key: "reviewed", label: "Independently reviewed" },
  { key: "self", label: "Self-reported" },
];

export const RECORD_LENGTHS = [3, 6, 12, 24] as const;
export const EXPERIENCE_MINIMUMS = [1, 3, 5, 10] as const;

export const SORT_OPTIONS: { key: DirectorySort; label: string }[] = [
  { key: "recent", label: "Recently updated" },
  { key: "record", label: "Longest record" },
  { key: "name", label: "Name" },
];

export const EMPTY_FILTERS: DirectoryFilters = {
  q: "",
  markets: [],
  strategyTags: [],
  regions: [],
  capitalBand: null,
  source: null,
  minMonths: 0,
  minExperience: 0,
  accepting: false,
  registered: false,
};

export const DEFAULT_VIEW: DirectoryView = {
  filters: EMPTY_FILTERS,
  sort: "recent",
  tab: "all",
  prefsOff: false,
};

const MAX_QUERY = 100;

/* ------------------------------------------------------------------ URL -- */

type ParamRecord = Record<string, string | string[] | undefined>;
type ParamSource = URLSearchParams | ParamRecord;

function readAll(params: ParamSource, key: string): string[] {
  const raw =
    params instanceof URLSearchParams
      ? params.getAll(key)
      : [params[key]].flat().filter((v): v is string => typeof v === "string");
  // Accept both repeated keys (?market=a&market=b) and comma lists (?market=a,b).
  return raw.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

function readOne(params: ParamSource, key: string): string | null {
  return readAll(params, key)[0] ?? null;
}

function readThreshold(params: ParamSource, key: string, allowed: readonly number[]): number {
  const n = Number(readOne(params, key));
  return allowed.includes(n) ? n : 0;
}

function readFlag(params: ParamSource, key: string): boolean {
  const v = readOne(params, key);
  return v === "1" || v === "true";
}

function sourceKey(value: string | null): string | null {
  return value && RECORD_SOURCES.some((s) => s.key === value) ? value : null;
}

/**
 * Parse /explore search params into a validated view. Unknown keys and values
 * are dropped (the URL is untrusted input). Following/Watchlist tabs need a
 * signed-in viewer.
 */
export function parseDirectoryView(params: ParamSource, opts: { signedIn: boolean }): DirectoryView {
  const tabRaw = readOne(params, "tab");
  const sortRaw = readOne(params, "sort");
  // Free text is read raw: commas are legitimate search characters.
  const rawQ = params instanceof URLSearchParams ? params.get("q") : [params.q].flat()[0];
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, MAX_QUERY) : "";
  return {
    filters: {
      q,
      markets: pickKeys("markets", readAll(params, "market")),
      strategyTags: pickKeys("strategyTags", readAll(params, "strategy")),
      regions: pickKeys("regions", readAll(params, "region")),
      capitalBand: pickKey("capitalBands", readOne(params, "capital")),
      source: sourceKey(readOne(params, "source")),
      minMonths: readThreshold(params, "months", RECORD_LENGTHS),
      minExperience: readThreshold(params, "exp", EXPERIENCE_MINIMUMS),
      accepting: readFlag(params, "accepting"),
      registered: readFlag(params, "registered"),
    },
    sort: sortRaw === "record" || sortRaw === "name" ? sortRaw : "recent",
    tab: opts.signedIn && (tabRaw === "following" || tabRaw === "watchlist") ? tabRaw : "all",
    prefsOff: readOne(params, "prefs") === "off",
  };
}

/** Serialize a view to a query string (no leading "?"); defaults are omitted. */
export function serializeDirectoryView(view: DirectoryView): string {
  const p = new URLSearchParams();
  const f = view.filters;
  const q = f.q.trim().slice(0, MAX_QUERY);
  if (q) p.set("q", q);
  if (f.markets.length) p.set("market", f.markets.join(","));
  if (f.strategyTags.length) p.set("strategy", f.strategyTags.join(","));
  if (f.regions.length) p.set("region", f.regions.join(","));
  if (f.capitalBand) p.set("capital", f.capitalBand);
  if (f.source) p.set("source", f.source);
  if (f.minMonths) p.set("months", String(f.minMonths));
  if (f.minExperience) p.set("exp", String(f.minExperience));
  if (f.accepting) p.set("accepting", "1");
  if (f.registered) p.set("registered", "1");
  if (view.sort !== "recent") p.set("sort", view.sort);
  if (view.tab !== "all") p.set("tab", view.tab);
  if (view.prefsOff) p.set("prefs", "off");
  return p.toString();
}

/** Number of active filter values (each chip / toggle / threshold counts once). */
export function activeFilterCount(f: DirectoryFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.markets.length +
    f.strategyTags.length +
    f.regions.length +
    (f.capitalBand ? 1 : 0) +
    (f.source ? 1 : 0) +
    (f.minMonths ? 1 : 0) +
    (f.minExperience ? 1 : 0) +
    (f.accepting ? 1 : 0) +
    (f.registered ? 1 : 0)
  );
}

/* ---------------------------------------------------------- Preferences -- */

/** Filters from a client's stated interests, or null when they stated none. */
export function preferenceFilters(prefs: ClientPreferences | null | undefined): DirectoryFilters | null {
  if (!prefs) return null;
  const markets = pickKeys("markets", prefs.markets);
  const regions = pickKeys("regions", prefs.regions);
  const strategyTags = pickKeys("strategyTags", prefs.strategyTags);
  if (!markets.length && !regions.length && !strategyTags.length) return null;
  return { ...EMPTY_FILTERS, markets, regions, strategyTags };
}

/**
 * Effective filters: explicit URL filters win; otherwise a client's saved
 * preferences prefill the view unless they turned them off.
 */
export function resolveFilters(
  view: DirectoryView,
  prefs: ClientPreferences | null | undefined,
): { filters: DirectoryFilters; usingPreferences: boolean } {
  if (view.prefsOff || activeFilterCount(view.filters) > 0) {
    return { filters: view.filters, usingPreferences: false };
  }
  const fromPrefs = preferenceFilters(prefs);
  return fromPrefs
    ? { filters: fromPrefs, usingPreferences: true }
    : { filters: view.filters, usingPreferences: false };
}

/* ------------------------------------------------------ Filter + sort -- */

/** A declared registration is any registration type other than "none". */
export function hasDeclaredRegistration(registrationType: string | null | undefined): boolean {
  return !!registrationType && registrationType !== "none";
}

function searchText(t: FilterableTrader): string {
  return [t.displayName, t.headline, t.strategy, ...optionLabels("strategyTags", t.strategyTags)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function anyOf(selected: string[], values: readonly string[]): boolean {
  return selected.length === 0 || selected.some((s) => values.includes(s));
}

export function matchesFilters(t: FilterableTrader, f: DirectoryFilters): boolean {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const haystack = searchText(t);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  if (!anyOf(f.markets, t.markets)) return false;
  if (!anyOf(f.strategyTags, t.strategyTags)) return false;
  if (f.regions.length && !(t.region && f.regions.includes(t.region))) return false;
  if (f.capitalBand && t.capitalBand !== f.capitalBand) return false;
  if (f.source) {
    const label = RECORD_SOURCES.find((s) => s.key === f.source)?.label;
    if (!t.record || t.record.source !== label) return false;
  }
  if (f.minMonths && (t.record?.months ?? 0) < f.minMonths) return false;
  if (f.minExperience && (t.experienceYears ?? -1) < f.minExperience) return false;
  if (f.accepting && !t.acceptInquiries) return false;
  if (f.registered && !hasDeclaredRegistration(t.registrationType)) return false;
  return true;
}

function byRecent(a: FilterableTrader, b: FilterableTrader): number {
  return b.lastActive.localeCompare(a.lastActive);
}

const nameCollator = new Intl.Collator("en", { sensitivity: "base" });

/** Recency, record length, or name. There is deliberately no performance sort. */
export function sortTraders<T extends FilterableTrader>(traders: readonly T[], sort: DirectorySort): T[] {
  const out = [...traders];
  if (sort === "name") {
    out.sort((a, b) => nameCollator.compare(a.displayName, b.displayName) || byRecent(a, b));
  } else if (sort === "record") {
    out.sort((a, b) => (b.record?.months ?? -1) - (a.record?.months ?? -1) || byRecent(a, b));
  } else {
    out.sort(byRecent);
  }
  return out;
}

export function inTab(t: FilterableTrader, tab: DirectoryTab): boolean {
  return tab === "following" ? t.following : tab === "watchlist" ? t.watching : true;
}

/** Tab → filters → sort. */
export function applyDirectory<T extends FilterableTrader>(
  traders: readonly T[],
  opts: { filters: DirectoryFilters; sort: DirectorySort; tab: DirectoryTab },
): T[] {
  return sortTraders(
    traders.filter((t) => inTab(t, opts.tab) && matchesFilters(t, opts.filters)),
    opts.sort,
  );
}

export function tabCounts(traders: readonly FilterableTrader[]): Record<DirectoryTab, number> {
  return {
    all: traders.length,
    following: traders.filter((t) => t.following).length,
    watchlist: traders.filter((t) => t.watching).length,
  };
}

/* ------------------------------------------------------------ Display -- */

/** Period return as a signed percent from a fraction (0.123 → "+12.3%"). */
export function formatReturn(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** Max drawdown from a percent number (6.9 → "6.9%"). */
export function formatDrawdown(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${Math.abs(pct).toFixed(1)}%`;
}

export function formatMonths(months: number | null | undefined): string {
  if (!months) return "—";
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function formatExperience(years: number | null | undefined): string | null {
  if (years == null || years < 0) return null;
  if (years === 0) return "Under 1 yr experience";
  return `${years} yr${years === 1 ? "" : "s"} experience`;
}
