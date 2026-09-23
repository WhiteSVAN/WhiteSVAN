import { describe, expect, it } from "vitest";
import { findCoverageGaps, gapShare } from "./coverage";

describe("findCoverageGaps", () => {
  it("ignores weekends and short breaks", () => {
    // Fri → Mon is 2 silent days; a holiday week is 8.
    expect(findCoverageGaps(["2026-01-02", "2026-01-05", "2026-01-14"])).toEqual([]);
  });

  it("reports long silent stretches with their size", () => {
    expect(findCoverageGaps(["2026-01-02", "2026-02-02", "2026-02-03"])).toEqual([
      { from: "2026-01-02", to: "2026-02-02", days: 30 },
    ]);
  });

  it("handles unsorted input and duplicates", () => {
    const gaps = findCoverageGaps(["2026-03-20", "2026-01-01", "2026-01-01", "2026-01-02"]);
    expect(gaps).toEqual([{ from: "2026-01-02", to: "2026-03-20", days: 76 }]);
  });

  it("respects a custom threshold", () => {
    expect(findCoverageGaps(["2026-01-02", "2026-01-09"], 5)).toHaveLength(1);
    expect(findCoverageGaps(["2026-01-02", "2026-01-09"], 7)).toHaveLength(0);
  });

  it("returns nothing for fewer than two days", () => {
    expect(findCoverageGaps([])).toEqual([]);
    expect(findCoverageGaps(["2026-01-02"])).toEqual([]);
  });
});

describe("gapShare", () => {
  it("is the fraction of the covered window inside gaps", () => {
    const dates = ["2026-01-01", "2026-01-31"];
    const gaps = findCoverageGaps(dates);
    expect(gapShare(dates, gaps)).toBeCloseTo(29 / 31);
  });

  it("is zero without gaps", () => {
    expect(gapShare(["2026-01-01"], [])).toBe(0);
  });
});
