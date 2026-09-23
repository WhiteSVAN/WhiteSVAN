import { describe, it, expect } from "vitest";
import { buildDiligenceBrief } from "@/lib/diligence";
import type { Metrics } from "@/lib/metrics";
import type { TrustMetrics } from "@/lib/trust";

function metrics(over: Partial<Metrics> = {}): Metrics {
  return {
    startingBalance: 10000,
    netPnl: 4000,
    endingBalance: 14000,
    returnPct: 0.4,
    tradingDays: 120,
    winningDays: 72,
    losingDays: 48,
    winRate: 0.6,
    avgGreenDay: 200,
    avgRedDay: -120,
    bestDay: 800,
    worstDay: -400,
    grossProfit: 8000,
    grossLoss: 4000,
    profitFactor: 2,
    maxDrawdown: 800,
    maxDrawdownPct: 8,
    equityCurve: [],
    consistencyScore: 80,
    ...over,
  };
}

function trust(over: Partial<TrustMetrics> = {}, m: Partial<Metrics> = {}): TrustMetrics {
  return {
    metrics: metrics(m),
    bestDayShare: 0.2,
    top3Share: 0.4,
    profitWithoutBestDay: 3200,
    badToGoodRatio: 0.8,
    drawdownSeverity: "controlled",
    bounceBackDays: 5,
    daysUnderwater: null,
    proofLevel: 4,
    scores: {
      profit: 80,
      riskControl: 80,
      consistency: 80,
      discipline: 80,
      proof: 80,
      updateReliability: 80,
      transparency: 80,
    },
    verdict: { headline: "Strong, verified record", body: "" },
    ...over,
  };
}

describe("buildDiligenceBrief", () => {
  it("summarizes positive observations without assigning a posture or score", () => {
    const brief = buildDiligenceBrief(trust());
    expect(brief.strengths.length).toBeGreaterThan(brief.risks.length);
    expect(brief.strengths.some((s) => s.label === "Positive period return")).toBe(true);
    expect(brief.dataQuality.label).toBe("Additional document attached");
    // Always carries the not-advice framing (guardrail).
    expect(brief.summary).toMatch(/not investment advice/i);
  });

  it("flags a weak record with concrete risks", () => {
    const brief = buildDiligenceBrief(
      trust(
        {
          bestDayShare: 0.5,
          badToGoodRatio: 1.6,
          drawdownSeverity: "severe",
          bounceBackDays: null,
          daysUnderwater: 20,
          proofLevel: 2,
          scores: {
            profit: 30,
            riskControl: 30,
            consistency: 30,
            discipline: 30,
            proof: 40,
            updateReliability: 30,
            transparency: 30,
          },
        },
        { returnPct: -0.1, winRate: 0.3, maxDrawdownPct: 40, profitFactor: 0.9, tradingDays: 40 },
      ),
    );
    expect(brief.strengths.length).toBe(0);
    expect(brief.risks.some((r) => r.label === "Big-win dependency")).toBe(true);
    expect(brief.risks.some((r) => r.label === "Deep drawdown")).toBe(true);
    expect(brief.risks.some((r) => r.label === "Limited verification")).toBe(true);
  });

  it("never recommends allocating capital (guardrail)", () => {
    const all = buildDiligenceBrief(trust());
    const text = [
      all.summary,
      ...all.strengths.map((s) => s.detail),
      ...all.risks.map((r) => r.detail),
      ...all.watchItems.map((w) => w.detail),
    ]
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/you should invest|allocate \d|copy (this|my)|guaranteed/);
  });
});
