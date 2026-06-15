import { describe, it, expect } from "vitest";
import { computeTrustMetrics } from "./trust";
import { diffVersions, type VersionSnapshot } from "./version";
import { generateRiskEvents, buildChangeSummary } from "./risk-events";

const day = (date: string, netPnl: number) => ({ date, netPnl });

// A run with a clear drawdown and a single dominant winning day.
const days = [
  day("2026-05-01", 100),
  day("2026-05-02", 2000), // outlier best day
  day("2026-05-03", -400),
  day("2026-05-04", -500),
  day("2026-05-05", 150),
];
const trust = computeTrustMetrics(days, 10000, 2);

const snapOf = (over: Partial<VersionSnapshot> = {}): VersionSnapshot => ({
  netPnl: trust.metrics.netPnl,
  returnPct: trust.metrics.returnPct,
  transparencyScore: trust.scores.transparency,
  proofLevel: trust.proofLevel,
  maxDrawdownPct: trust.metrics.maxDrawdownPct,
  periodEnd: "2026-05-05",
  ...over,
});

describe("generateRiskEvents", () => {
  it("flags drawdown and big-win dependency on a first publish", () => {
    const diff = diffVersions(null, snapOf());
    const types = generateRiskEvents(trust, diff, "fresh").map((e) => e.type);
    expect(types).toContain("DRAWDOWN");
    expect(types).toContain("BIG_WIN_DEPENDENCY");
    expect(types).not.toContain("SCORE_CHANGE"); // no prior version to compare
  });

  it("emits a SCORE_CHANGE event when the score moved vs the prior version", () => {
    const prev = snapOf({ transparencyScore: trust.scores.transparency - 6 });
    const diff = diffVersions(prev, snapOf());
    const score = generateRiskEvents(trust, diff, "fresh").find((e) => e.type === "SCORE_CHANGE");
    expect(score).toBeDefined();
    expect(score?.severity).toBe("INFO"); // score rose → informational
  });

  it("emits a STALE_PROFILE warning only when freshness is stale", () => {
    const diff = diffVersions(null, snapOf());
    expect(generateRiskEvents(trust, diff, "fresh").some((e) => e.type === "STALE_PROFILE")).toBe(false);
    expect(generateRiskEvents(trust, diff, "stale").some((e) => e.type === "STALE_PROFILE")).toBe(true);
  });

  it("all generated descriptions avoid advice/guarantee language", () => {
    const diff = diffVersions(null, snapOf());
    const banned = /\b(guaranteed|risk-?free|safe investment|you should|invest|recommend)\b/i;
    for (const e of generateRiskEvents(trust, diff, "stale")) {
      expect(e.description).not.toMatch(banned);
      expect(e.title).not.toMatch(banned);
    }
  });
});

describe("buildChangeSummary", () => {
  it("describes the first publish with day count and net P&L", () => {
    const summary = buildChangeSummary(trust, diffVersions(null, snapOf()));
    expect(summary).toMatch(/First published update/);
    expect(summary).toMatch(/trading days/);
  });

  it("summarizes deltas vs the prior version", () => {
    const prev = snapOf({ netPnl: trust.metrics.netPnl - 500, transparencyScore: trust.scores.transparency - 3 });
    const summary = buildChangeSummary(trust, diffVersions(prev, snapOf()));
    expect(summary).toMatch(/Since the last update/);
    expect(summary).toMatch(/net P&L/);
  });
});
