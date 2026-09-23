import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  DEFAULT_VIEW,
  EMPTY_FILTERS,
  RECORD_SOURCES,
  activeFilterCount,
  applyDirectory,
  formatDrawdown,
  formatExperience,
  formatMonths,
  formatReturn,
  hasDeclaredRegistration,
  matchesFilters,
  parseDirectoryView,
  preferenceFilters,
  resolveFilters,
  serializeDirectoryView,
  sortTraders,
  tabCounts,
  type DirectoryView,
  type FilterableTrader,
} from "./directory-filters";
import { PROOF_LEVELS } from "./trust";
import { toRecordContext } from "./record-context";

function trader(overrides: Partial<FilterableTrader> = {}): FilterableTrader {
  return {
    displayName: "Asha Rao",
    headline: "Index options writer",
    strategy: "Weekly NIFTY premium selling",
    markets: ["in_fno"],
    strategyTags: ["options_selling", "systematic"],
    region: "IN",
    capitalBand: "10k_100k",
    experienceYears: 6,
    registrationType: "sebi_ra",
    acceptInquiries: true,
    lastActive: "2026-09-01T00:00:00.000Z",
    following: false,
    watching: false,
    record: { source: "Imported trading history", months: 14 },
    ...overrides,
  };
}

const params = (qs: string) => new URLSearchParams(qs);

describe("parseDirectoryView", () => {
  it("returns defaults for an empty query", () => {
    expect(parseDirectoryView(params(""), { signedIn: true })).toEqual(DEFAULT_VIEW);
  });

  it("reads comma lists and repeated keys, dropping unknown option keys", () => {
    const view = parseDirectoryView(
      params("market=in_fno,bogus&market=us_options&strategy=swing&region=IN&region=XX"),
      { signedIn: false },
    );
    expect(view.filters.markets).toEqual(["in_fno", "us_options"]);
    expect(view.filters.strategyTags).toEqual(["swing"]);
    expect(view.filters.regions).toEqual(["IN"]);
  });

  it("only accepts listed thresholds, sources, and sorts", () => {
    const view = parseDirectoryView(params("months=7&exp=5&source=hacked&sort=return&capital=gt_1m"), {
      signedIn: true,
    });
    expect(view.filters.minMonths).toBe(0);
    expect(view.filters.minExperience).toBe(5);
    expect(view.filters.source).toBeNull();
    expect(view.filters.capitalBand).toBe("gt_1m");
    expect(view.sort).toBe("recent");
  });

  it("gates personal tabs behind sign-in", () => {
    expect(parseDirectoryView(params("tab=watchlist"), { signedIn: false }).tab).toBe("all");
    expect(parseDirectoryView(params("tab=watchlist"), { signedIn: true }).tab).toBe("watchlist");
    expect(parseDirectoryView(params("tab=admin"), { signedIn: true }).tab).toBe("all");
  });

  it("keeps commas in free text and caps its length", () => {
    expect(parseDirectoryView(params("q=gamma,%20flows"), { signedIn: false }).filters.q).toBe("gamma, flows");
    expect(parseDirectoryView(params(`q=${"x".repeat(300)}`), { signedIn: false }).filters.q).toHaveLength(100);
  });

  it("accepts a Next.js searchParams record", () => {
    const view = parseDirectoryView(
      { q: "  futures ", market: ["us_futures", "forex"], accepting: "1", registered: "true", prefs: "off" },
      { signedIn: false },
    );
    expect(view.filters.q).toBe("futures");
    expect(view.filters.markets).toEqual(["us_futures", "forex"]);
    expect(view.filters.accepting).toBe(true);
    expect(view.filters.registered).toBe(true);
    expect(view.prefsOff).toBe(true);
  });
});

describe("serializeDirectoryView", () => {
  it("omits defaults", () => {
    expect(serializeDirectoryView(DEFAULT_VIEW)).toBe("");
  });

  it("round-trips through parse", () => {
    const view: DirectoryView = {
      filters: {
        q: "nifty weekly",
        markets: ["in_fno", "in_equities"],
        strategyTags: ["intraday"],
        regions: ["IN"],
        capitalBand: "100k_1m",
        source: "statement",
        minMonths: 12,
        minExperience: 3,
        accepting: true,
        registered: true,
      },
      sort: "record",
      tab: "following",
      prefsOff: true,
    };
    const qs = serializeDirectoryView(view);
    expect(parseDirectoryView(params(qs), { signedIn: true })).toEqual(view);
  });
});

describe("client preferences", () => {
  const prefs = { markets: ["in_fno"], regions: ["IN"], strategyTags: [] };

  it("prefills when the URL carries no explicit filters", () => {
    const resolved = resolveFilters(DEFAULT_VIEW, prefs);
    expect(resolved.usingPreferences).toBe(true);
    expect(resolved.filters.markets).toEqual(["in_fno"]);
    expect(resolved.filters.regions).toEqual(["IN"]);
  });

  it("lets any explicit URL filter override preferences", () => {
    const view = { ...DEFAULT_VIEW, filters: { ...EMPTY_FILTERS, accepting: true } };
    const resolved = resolveFilters(view, prefs);
    expect(resolved.usingPreferences).toBe(false);
    expect(resolved.filters.markets).toEqual([]);
  });

  it("respects prefs=off and empty preferences", () => {
    expect(resolveFilters({ ...DEFAULT_VIEW, prefsOff: true }, prefs).usingPreferences).toBe(false);
    expect(resolveFilters(DEFAULT_VIEW, { markets: [], regions: [], strategyTags: [] }).usingPreferences).toBe(false);
    expect(resolveFilters(DEFAULT_VIEW, null).usingPreferences).toBe(false);
  });

  it("drops stale option keys from stored preferences", () => {
    expect(preferenceFilters({ markets: ["gone"], regions: [], strategyTags: [] })).toBeNull();
  });

  it("sort and tab alone do not override preferences", () => {
    expect(resolveFilters({ ...DEFAULT_VIEW, sort: "name", tab: "following" }, prefs).usingPreferences).toBe(true);
  });
});

describe("matchesFilters", () => {
  const t = trader();

  it("searches name, headline, strategy, and strategy tags; every term must match", () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, q: "asha" })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, q: "premium NIFTY" })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, q: "options selling" })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, q: "asha crypto" })).toBe(false);
  });

  it("uses any-of within a facet and AND across facets", () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, markets: ["us_options", "in_fno"] })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, markets: ["in_fno"], regions: ["US"] })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, strategyTags: ["swing"] })).toBe(false);
    expect(matchesFilters(trader({ region: null }), { ...EMPTY_FILTERS, regions: ["IN"] })).toBe(false);
  });

  it("matches record source by its factual label", () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, source: "imported" })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, source: "statement" })).toBe(false);
    expect(matchesFilters(trader({ record: null }), { ...EMPTY_FILTERS, source: "imported" })).toBe(false);
  });

  it("applies record-length and experience minimums", () => {
    expect(matchesFilters(t, { ...EMPTY_FILTERS, minMonths: 12 })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, minMonths: 24 })).toBe(false);
    expect(matchesFilters(trader({ record: null }), { ...EMPTY_FILTERS, minMonths: 3 })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, minExperience: 5 })).toBe(true);
    expect(matchesFilters(trader({ experienceYears: null }), { ...EMPTY_FILTERS, minExperience: 1 })).toBe(false);
  });

  it("filters availability and declared registration", () => {
    expect(matchesFilters(trader({ acceptInquiries: false }), { ...EMPTY_FILTERS, accepting: true })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, registered: true })).toBe(true);
    expect(matchesFilters(trader({ registrationType: "none" }), { ...EMPTY_FILTERS, registered: true })).toBe(false);
    expect(matchesFilters(trader({ registrationType: null }), { ...EMPTY_FILTERS, registered: true })).toBe(false);
  });

  it("counts active filter values", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: " ", markets: ["a", "b"], accepting: true })).toBe(3);
  });
});

describe("sorting and tabs", () => {
  const a = trader({ displayName: "zed", lastActive: "2026-09-10T00:00:00.000Z", record: { source: "x", months: 3 }, following: true });
  const b = trader({ displayName: "Amy", lastActive: "2026-08-01T00:00:00.000Z", record: { source: "x", months: 30 }, watching: true });
  const c = trader({ displayName: "bo", lastActive: "2026-09-20T00:00:00.000Z", record: null });

  it("defaults to most recently updated", () => {
    expect(sortTraders([a, b, c], "recent").map((t) => t.displayName)).toEqual(["bo", "zed", "Amy"]);
  });

  it("sorts by record length with no-record last", () => {
    expect(sortTraders([a, b, c], "record").map((t) => t.displayName)).toEqual(["Amy", "zed", "bo"]);
  });

  it("sorts by name case-insensitively", () => {
    expect(sortTraders([a, b, c], "name").map((t) => t.displayName)).toEqual(["Amy", "bo", "zed"]);
  });

  it("never reorders by return: the sort input has no performance key", () => {
    // Guardrail: DirectorySort is recency / record length / name only.
    expect(serializeDirectoryView({ ...DEFAULT_VIEW, sort: "recent" })).not.toContain("return");
  });

  it("restricts to following / watchlist tabs and counts them", () => {
    const opts = { filters: EMPTY_FILTERS, sort: "recent" as const };
    expect(applyDirectory([a, b, c], { ...opts, tab: "following" })).toEqual([a]);
    expect(applyDirectory([a, b, c], { ...opts, tab: "watchlist" })).toEqual([b]);
    expect(tabCounts([a, b, c])).toEqual({ all: 3, following: 1, watchlist: 1 });
  });
});

describe("record source labels", () => {
  it("match the labels the record context produces", () => {
    const labels = RECORD_SOURCES.map((s) => s.label);
    for (const level of Object.values(PROOF_LEVELS)) expect(labels).toContain(level.label);
    const base = {
      id: "v1",
      versionNumber: 1,
      proofLevel: 2,
      periodStart: null,
      periodEnd: null,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(labels).toContain(toRecordContext({ ...base, sourceBatch: { source: "BROKER_API" } }).source);
    expect(labels).toContain(toRecordContext({ ...base, sourceBatch: null }).source);
  });
});

describe("display helpers", () => {
  it("formats return and drawdown as context", () => {
    expect(formatReturn(0.1234)).toBe("+12.3%");
    expect(formatReturn(-0.05)).toBe("−5.0%");
    expect(formatReturn(null)).toBe("—");
    expect(formatDrawdown(6.94)).toBe("6.9%");
    expect(formatDrawdown(null)).toBe("—");
  });

  it("formats months and experience", () => {
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(14)).toBe("14 months");
    expect(formatMonths(null)).toBe("—");
    expect(formatExperience(0)).toBe("Under 1 yr experience");
    expect(formatExperience(1)).toBe("1 yr experience");
    expect(formatExperience(null)).toBeNull();
    expect(hasDeclaredRegistration("other")).toBe(true);
  });
});
