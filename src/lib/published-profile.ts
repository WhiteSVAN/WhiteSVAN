import { computeTrustMetrics, type DrawdownSeverity, type ProofLevel, type TrustMetrics } from "@/lib/trust";
import type { Metrics } from "@/lib/metrics";

type JsonRecord = Record<string, unknown>;

export interface PublishedTrustSnapshot {
  trust: TrustMetrics;
  dailySeries: { date: string; netPnl: number }[];
  equitySeries: { date: string; equity: number }[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value == null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function proofLevel(value: unknown): ProofLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 2;
}

function severity(value: unknown, fallback: DrawdownSeverity): DrawdownSeverity {
  return value === "controlled" || value === "elevated" || value === "high" || value === "severe"
    ? value
    : fallback;
}

function parseScores(value: unknown, fallback: TrustMetrics["scores"]): TrustMetrics["scores"] {
  if (!isRecord(value)) return fallback;
  return {
    profit: numberOr(value.profit, fallback.profit),
    riskControl: numberOr(value.riskControl, fallback.riskControl),
    consistency: numberOr(value.consistency, fallback.consistency),
    discipline: numberOr(value.discipline, fallback.discipline),
    proof: numberOr(value.proof, fallback.proof),
    updateReliability: numberOr(value.updateReliability, fallback.updateReliability),
    transparency: numberOr(value.transparency, fallback.transparency),
  };
}

function parseVerdict(value: unknown, fallback: TrustMetrics["verdict"]): TrustMetrics["verdict"] {
  if (!isRecord(value)) return fallback;
  return {
    headline: typeof value.headline === "string" ? value.headline : fallback.headline,
    body: typeof value.body === "string" ? value.body : fallback.body,
  };
}

function parseEquityCurve(value: unknown): Metrics["equityCurve"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) => {
    if (!isRecord(p) || typeof p.date !== "string") return [];
    const equity = numberOr(p.equity, NaN);
    const cumulativePnl = numberOr(p.cumulativePnl, NaN);
    if (!Number.isFinite(equity) || !Number.isFinite(cumulativePnl)) return [];
    return [{ date: p.date, equity, cumulativePnl }];
  });
}

function dailyFromEquityCurve(curve: Metrics["equityCurve"]): { date: string; netPnl: number }[] {
  let prior = 0;
  return curve.map((p) => {
    const netPnl = p.cumulativePnl - prior;
    prior = p.cumulativePnl;
    return { date: p.date, netPnl };
  });
}

export function publishedTrustFromMetrics(metricsJson: unknown): PublishedTrustSnapshot | null {
  if (!isRecord(metricsJson)) return null;

  const equityCurve = parseEquityCurve(metricsJson.equityCurve);
  if (equityCurve.length === 0) return null;

  const startingBalance = numberOr(metricsJson.startingBalance, 0);
  const dailySeries = dailyFromEquityCurve(equityCurve);
  const publishedProofLevel = proofLevel(metricsJson.proofLevel);
  const scoresRecord = isRecord(metricsJson.scores) ? metricsJson.scores : {};
  const updateReliability = numberOr(scoresRecord.updateReliability, 50);
  const computed = computeTrustMetrics(dailySeries, startingBalance, publishedProofLevel, updateReliability);

  const metrics: Metrics = {
    ...computed.metrics,
    startingBalance,
    netPnl: numberOr(metricsJson.netPnl, computed.metrics.netPnl),
    endingBalance: numberOr(metricsJson.endingBalance, computed.metrics.endingBalance),
    returnPct:
      metricsJson.returnPct == null ? null : numberOr(metricsJson.returnPct, computed.metrics.returnPct ?? 0),
    tradingDays: numberOr(metricsJson.tradingDays, computed.metrics.tradingDays),
    winningDays: numberOr(metricsJson.winningDays, computed.metrics.winningDays),
    losingDays: numberOr(metricsJson.losingDays, computed.metrics.losingDays),
    winRate: numberOr(metricsJson.winRate, computed.metrics.winRate),
    avgGreenDay: numberOr(metricsJson.avgGreenDay, computed.metrics.avgGreenDay),
    avgRedDay: numberOr(metricsJson.avgRedDay, computed.metrics.avgRedDay),
    bestDay: numberOr(metricsJson.bestDay, computed.metrics.bestDay),
    worstDay: numberOr(metricsJson.worstDay, computed.metrics.worstDay),
    grossProfit: numberOr(metricsJson.grossProfit, computed.metrics.grossProfit),
    grossLoss: numberOr(metricsJson.grossLoss, computed.metrics.grossLoss),
    profitFactor:
      metricsJson.profitFactor == null
        ? null
        : numberOr(metricsJson.profitFactor, computed.metrics.profitFactor ?? 0),
    maxDrawdown: numberOr(metricsJson.maxDrawdown, computed.metrics.maxDrawdown),
    maxDrawdownPct: numberOr(metricsJson.maxDrawdownPct, computed.metrics.maxDrawdownPct),
    consistencyScore: numberOr(metricsJson.consistencyScore, computed.metrics.consistencyScore),
    equityCurve,
  };

  const bestDayShare =
    nullableNumber(metricsJson.bestDayShare) ??
    (metrics.netPnl > 0 ? clamp(metrics.bestDay / metrics.netPnl, 0, 1) : null);
  const badToGoodRatio =
    nullableNumber(metricsJson.badToGoodRatio) ??
    (metrics.avgGreenDay > 0 ? Math.abs(metrics.avgRedDay) / metrics.avgGreenDay : null);

  const trust: TrustMetrics = {
    ...computed,
    metrics,
    bestDayShare,
    top3Share: nullableNumber(metricsJson.top3Share) ?? computed.top3Share,
    profitWithoutBestDay: numberOr(metricsJson.profitWithoutBestDay, metrics.netPnl - metrics.bestDay),
    badToGoodRatio,
    drawdownSeverity: severity(metricsJson.drawdownSeverity, computed.drawdownSeverity),
    bounceBackDays: nullableNumber(metricsJson.bounceBackDays) ?? computed.bounceBackDays,
    daysUnderwater: nullableNumber(metricsJson.daysUnderwater) ?? computed.daysUnderwater,
    proofLevel: publishedProofLevel,
    scores: parseScores(metricsJson.scores, computed.scores),
    verdict: parseVerdict(metricsJson.verdict, computed.verdict),
  };

  return {
    trust,
    dailySeries,
    equitySeries: equityCurve.map((p) => ({ date: p.date, equity: p.equity })),
  };
}
