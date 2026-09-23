import { describe, it, expect } from "vitest";
import { diffVersions, hasMeaningfulChange, type VersionSnapshot } from "./version";

const snap = (over: Partial<VersionSnapshot> = {}): VersionSnapshot => ({
  netPnl: 1000,
  returnPct: 0.1,
  maxDrawdownPct: 12,
  periodEnd: "2026-05-31",
  ...over,
});

describe("diffVersions", () => {
  it("treats a null previous as the first publish (deltas = absolute values)", () => {
    const d = diffVersions(null, snap());
    expect(d.isFirst).toBe(true);
    expect(d.netPnlDelta).toBe(1000);
    expect(d.newDaysCovered).toBe(true);
  });

  it("computes signed deltas against the prior version", () => {
    const prev = snap({ netPnl: 1000, maxDrawdownPct: 12, returnPct: 0.1 });
    const next = snap({
      netPnl: 1500,
      maxDrawdownPct: 18,
      returnPct: 0.15,
      periodEnd: "2026-06-15",
    });
    const d = diffVersions(prev, next);
    expect(d.isFirst).toBe(false);
    expect(d.netPnlDelta).toBe(500);
    expect(d.drawdownPctDelta).toBe(6); // drawdown got deeper
    expect(d.returnPctDelta).toBeCloseTo(0.05);
    expect(d.newDaysCovered).toBe(true);
  });

  it("returnPctDelta is null when either side is unknown", () => {
    expect(diffVersions(snap({ returnPct: null }), snap()).returnPctDelta).toBeNull();
    expect(diffVersions(snap(), snap({ returnPct: null })).returnPctDelta).toBeNull();
  });

  it("newDaysCovered is false when coverage did not advance", () => {
    const prev = snap({ periodEnd: "2026-06-15" });
    const next = snap({ periodEnd: "2026-06-15" });
    expect(diffVersions(prev, next).newDaysCovered).toBe(false);
  });
});

describe("hasMeaningfulChange", () => {
  it("is always true for the first publish", () => {
    expect(hasMeaningfulChange(diffVersions(null, snap()))).toBe(true);
  });

  it("is false when nothing material changed", () => {
    const same = snap();
    expect(hasMeaningfulChange(diffVersions(same, same))).toBe(false);
  });

  it("is true when net P&L moves by at least a cent", () => {
    const d = diffVersions(snap({ netPnl: 1000 }), snap({ netPnl: 1000.5 }));
    expect(hasMeaningfulChange(d)).toBe(true);
  });
});
