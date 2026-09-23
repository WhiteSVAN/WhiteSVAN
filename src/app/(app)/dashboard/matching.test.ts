import { describe, expect, it } from "vitest";
import { hasPreferences, matchesPreferences, pickMatches } from "./matching";

const t = (id: string, markets: string[], strategyTags: string[], region: string | null) => ({
  id,
  markets,
  strategyTags,
  region,
});

const TRADERS = [
  t("a", ["in_fno"], ["options_selling"], "IN"),
  t("b", ["us_futures"], ["intraday"], "US"),
  t("c", ["in_equities", "in_fno"], ["swing"], "IN"),
  t("d", [], [], null),
];

describe("hasPreferences", () => {
  it("is false for null or empty preferences", () => {
    expect(hasPreferences(null)).toBe(false);
    expect(hasPreferences({ markets: [], regions: [], strategyTags: [] })).toBe(false);
    expect(hasPreferences({ markets: ["in_fno"], regions: [], strategyTags: [] })).toBe(true);
  });
});

describe("matchesPreferences", () => {
  it("is any-of within a dimension", () => {
    const prefs = { markets: ["in_fno", "crypto"], regions: [], strategyTags: [] };
    expect(matchesPreferences(TRADERS[0], prefs)).toBe(true);
    expect(matchesPreferences(TRADERS[1], prefs)).toBe(false);
  });

  it("is all-of across the dimensions that were set", () => {
    const prefs = { markets: ["in_fno"], regions: ["IN"], strategyTags: ["swing"] };
    expect(matchesPreferences(TRADERS[0], prefs)).toBe(false); // wrong style
    expect(matchesPreferences(TRADERS[2], prefs)).toBe(true);
  });

  it("never matches a region filter when the trader has no region", () => {
    expect(matchesPreferences(TRADERS[3], { markets: [], regions: ["IN"], strategyTags: [] })).toBe(false);
  });
});

describe("pickMatches", () => {
  it("returns the most recent traders unchanged when no preferences are set", () => {
    expect(pickMatches(TRADERS, null, 2).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("keeps directory order and applies the limit", () => {
    const prefs = { markets: ["in_fno"], regions: [], strategyTags: [] };
    expect(pickMatches(TRADERS, prefs).map((x) => x.id)).toEqual(["a", "c"]);
    expect(pickMatches(TRADERS, prefs, 1).map((x) => x.id)).toEqual(["a"]);
  });

  it("handles an empty directory", () => {
    expect(pickMatches([], { markets: ["in_fno"], regions: [], strategyTags: [] })).toEqual([]);
  });
});
