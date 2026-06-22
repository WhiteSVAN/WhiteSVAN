/**
 * Quantidive client-trust metrics.
 *
 * Wraps the raw metrics engine and derives the plain-English signals a
 * non-finance client needs: how big the worst drop was (with a severity
 * label), whether profits came from one lucky day, how lopsided wins vs
 * losses are, how long recovery took, and a weighted Transparency Score.
 *
 * The Transparency Score is NOT an investment recommendation — it measures
 * data quality, risk visibility, and reporting discipline. Pure + tested.
 */
import { computeMetrics, type Metrics } from "@/lib/metrics";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type DrawdownSeverity = "controlled" | "elevated" | "high" | "severe";

/** Proof Level 1..5 — how reliable the underlying data is. Source-linked history = 2. */
export const PROOF_LEVELS = {
  1: { label: "Self-reported", blurb: "Numbers were supplied by the trader." },
  2: { label: "Source linked", blurb: "Trading history came from broker or prop-firm source data." },
  3: { label: "Statement checked", blurb: "A broker statement was uploaded and checked." },
  4: { label: "Tax return checked", blurb: "A tax return or official tax record was uploaded for verification." },
  5: { label: "Third-party verified", blurb: "Data was reviewed by an external auditor." },
} as const;

export type ProofLevel = keyof typeof PROOF_LEVELS;

export interface TrustScores {
  profit: number;
  riskControl: number;
  consistency: number;
  discipline: number;
  proof: number;
  /** Reporting discipline — how reliably the profile is refreshed (0..100). */
  updateReliability: number;
  /** Weighted composite (Quantidive Score v2), 0..100. */
  transparency: number;
}

export interface TrustMetrics {
  metrics: Metrics;
  /** Best single day as a share of net profit (Big-Win Dependency). */
  bestDayShare: number | null;
  /** Top 3 winning days as a share of net profit. */
  top3Share: number | null;
  /** Net profit with the single best day removed. */
  profitWithoutBestDay: number;
  /** |avg losing day| / avg winning day. >1 means losses are bigger than wins. */
  badToGoodRatio: number | null;
  drawdownSeverity: DrawdownSeverity;
  /** Trading days from the worst trough back to the prior high (null if still underwater). */
  bounceBackDays: number | null;
  /** Trading days spent below the prior high during the worst drawdown. */
  daysUnderwater: number | null;
  proofLevel: ProofLevel;
  scores: TrustScores;
  verdict: { headline: string; body: string };
}

export function drawdownSeverity(pct: number): DrawdownSeverity {
  if (pct < 10) return "controlled";
  if (pct < 20) return "elevated";
  if (pct < 35) return "high";
  return "severe";
}

/**
 * Worst-drawdown recovery: walk the equity path, find the deepest trough, then
 * the first later day that reclaims the pre-drop high.
 */
function recovery(
  days: Array<{ netPnl: number }>,
  startingBalance: number,
): { bounceBackDays: number | null; daysUnderwater: number | null } {
  let equity = startingBalance;
  let peak = startingBalance;
  let peakIdx = -1; // index of the day that set the current peak (-1 = before day 0)
  let maxDD = 0;
  let troughIdx = -1;
  let peakIdxAtTrough = -1;
  let peakValueAtTrough = startingBalance;

  const eq: number[] = [];
  days.forEach((d, i) => {
    equity += d.netPnl;
    eq.push(equity);
    if (equity > peak) {
      peak = equity;
      peakIdx = i;
    }
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      troughIdx = i;
      peakIdxAtTrough = peakIdx;
      peakValueAtTrough = peak;
    }
  });

  if (maxDD <= 0 || troughIdx < 0) return { bounceBackDays: null, daysUnderwater: null };

  let recoveryIdx = -1;
  for (let j = troughIdx + 1; j < eq.length; j++) {
    if (eq[j] >= peakValueAtTrough) {
      recoveryIdx = j;
      break;
    }
  }

  if (recoveryIdx < 0) {
    // Never recovered within the window.
    return { bounceBackDays: null, daysUnderwater: eq.length - 1 - peakIdxAtTrough };
  }
  return {
    bounceBackDays: recoveryIdx - troughIdx,
    daysUnderwater: recoveryIdx - peakIdxAtTrough,
  };
}

function buildVerdict(t: {
  metrics: Metrics;
  severity: DrawdownSeverity;
  bestDayShare: number | null;
  badToGoodRatio: number | null;
}): { headline: string; body: string } {
  const m = t.metrics;
  const profitable = m.netPnl > 0;

  let headline: string;
  if (!profitable) headline = "Unprofitable this period.";
  else if (t.severity === "severe" || t.severity === "high") headline = "Profitable, but high risk.";
  else if ((t.bestDayShare ?? 0) > 0.5) headline = "Profitable, but concentrated.";
  else headline = "Profitable and controlled.";

  const parts: string[] = [];
  parts.push(
    profitable
      ? `The account finished the period in profit across ${m.tradingDays} trading days.`
      : `The account finished the period at a loss across ${m.tradingDays} trading days.`,
  );
  if (t.severity === "severe") {
    parts.push(`It declined more than ${Math.round(m.maxDrawdownPct)}% from its peak before recovering — a severe drawdown.`);
  } else if (t.severity === "high") {
    parts.push(`Its largest decline reached ${m.maxDrawdownPct.toFixed(0)}% of peak equity, which is considered high.`);
  }
  if ((t.bestDayShare ?? 0) > 0.4) {
    parts.push(`Approximately ${Math.round((t.bestDayShare ?? 0) * 100)}% of total profit came from a single day, so the results may be outlier-driven.`);
  }
  if ((t.badToGoodRatio ?? 0) > 1.3) {
    parts.push(`A typical losing day is about ${t.badToGoodRatio!.toFixed(1)} times the size of a typical winning day.`);
  }
  if (m.tradingDays < 20) {
    parts.push(`This is an early track record (${m.tradingDays} trading days) and should be interpreted with caution.`);
  }
  return { headline, body: parts.join(" ") };
}

export function computeTrustMetrics(
  days: Array<{ date: string; netPnl: number }>,
  startingBalance: number,
  proofLevel: ProofLevel = 2,
  /** Reporting-discipline score 0..100 (from freshness/cadence). Neutral 50 default. */
  updateReliability = 50,
): TrustMetrics {
  const metrics = computeMetrics(days, startingBalance);

  const bestDayShare = metrics.netPnl > 0 ? clamp(metrics.bestDay / metrics.netPnl, 0, 1) : null;

  const top3 = days
    .map((d) => d.netPnl)
    .filter((v) => v > 0)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, v) => sum + v, 0);
  const top3Share = metrics.netPnl > 0 ? clamp(top3 / metrics.netPnl, 0, 1) : null;

  const badToGoodRatio =
    metrics.avgGreenDay > 0 ? Math.abs(metrics.avgRedDay) / metrics.avgGreenDay : null;

  const severity = drawdownSeverity(metrics.maxDrawdownPct);
  const { bounceBackDays, daysUnderwater } = recovery(days, startingBalance);
  const redRatio = metrics.tradingDays > 0 ? metrics.losingDays / metrics.tradingDays : 0;

  // Sub-scores (0..100). Simple, monotonic, and documented — not advice.
  const profit = clamp(50 + (metrics.returnPct ?? 0) * 200, 0, 100);
  let riskControl = 100 - metrics.maxDrawdownPct * 1.5;
  if (badToGoodRatio && badToGoodRatio > 1) riskControl -= (badToGoodRatio - 1) * 20;
  riskControl = clamp(riskControl, 0, 100);
  const consistency = metrics.consistencyScore;
  const discipline = clamp(100 - (bestDayShare ?? 0) * 60 - redRatio * 30, 0, 100);
  const proof = proofLevel * 20;

  // Quantidive Score v2 — rewards proof quality, risk control, and reporting
  // discipline over raw profit (profit capped at 10%).
  const reliability = clamp(updateReliability, 0, 100);
  const transparency = Math.round(
    0.25 * proof +
      0.25 * riskControl +
      0.2 * reliability +
      0.15 * consistency +
      0.1 * profit +
      0.05 * discipline,
  );

  return {
    metrics,
    bestDayShare,
    top3Share,
    profitWithoutBestDay: metrics.netPnl - metrics.bestDay,
    badToGoodRatio,
    drawdownSeverity: severity,
    bounceBackDays,
    daysUnderwater,
    proofLevel,
    scores: { profit, riskControl, consistency, discipline, proof, updateReliability: reliability, transparency },
    verdict: buildVerdict({ metrics, severity, bestDayShare, badToGoodRatio }),
  };
}
