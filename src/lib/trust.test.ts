import { describe, it, expect } from "vitest";
import { computeTrustMetrics, drawdownSeverity } from "./trust";

const day = (date: string, netPnl: number) => ({ date, netPnl });

describe("drawdownSeverity", () => {
  it("labels by threshold", () => {
    expect(drawdownSeverity(5)).toBe("controlled");
    expect(drawdownSeverity(15)).toBe("elevated");
    expect(drawdownSeverity(28)).toBe("high");
    expect(drawdownSeverity(50.8)).toBe("severe");
  });
});

describe("computeTrustMetrics", () => {
  it("derives client metrics and recovery from a controlled run", () => {
    const days = [
      day("2026-05-01", 100),
      day("2026-05-02", 400),
      day("2026-05-03", -300),
      day("2026-05-04", 600), // best day; reclaims the prior high
      day("2026-05-05", -200),
      day("2026-05-06", 300),
    ];
    const t = computeTrustMetrics(days, 10000, 2);

    expect(t.metrics.netPnl).toBe(900);
    expect(t.bestDayShare).toBeCloseTo(600 / 900); // best day / net profit
    expect(t.profitWithoutBestDay).toBe(300);
    expect(t.badToGoodRatio).toBeCloseTo(250 / (1400 / 4)); // |avg red| / avg green (4 green days)
    expect(t.drawdownSeverity).toBe("controlled");
    expect(t.bounceBackDays).toBe(1); // trough → reclaim in one day
    expect(t.daysUnderwater).toBe(2);
    expect(t.proofLevel).toBe(2);
    expect(t.scores.proof).toBe(40);
    expect(t.scores.transparency).toBeGreaterThanOrEqual(0);
    expect(t.scores.transparency).toBeLessThanOrEqual(100);
    // best-day share > 0.5 → concentrated verdict
    expect(t.verdict.headline).toBe("Profitable, but concentrated.");
  });

  it("flags a severe drawdown that never recovers in-window", () => {
    const days = [day("2026-05-01", 2000), day("2026-05-02", -1600), day("2026-05-03", 200)];
    const t = computeTrustMetrics(days, 1000, 2);

    expect(t.metrics.netPnl).toBe(600);
    expect(t.drawdownSeverity).toBe("severe"); // ~53% of peak
    expect(t.bounceBackDays).toBeNull();
    expect(t.verdict.headline).toBe("Profitable, but high risk.");
  });
});
