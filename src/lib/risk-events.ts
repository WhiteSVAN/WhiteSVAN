/**
 * Risk-event + change-summary generation (MVP2.3).
 *
 * Pure and dependency-free. Given the just-computed trust metrics and the diff
 * against the previous published version, derive the dated, plain-English risk
 * events to persist and a one-line "what changed" summary. The publish action
 * persists these; the public portal renders the client-visible ones.
 *
 * Compliance: descriptions state facts about *past* performance only — no advice,
 * no predictions, no "best/safe/guaranteed" language.
 */
import type { TrustMetrics } from "./trust";
import { drawdownSeverity } from "./trust";
import type { VersionDiff } from "./version";
import { formatMoney } from "./format";

export type RiskEventType =
  | "DRAWDOWN"
  | "WORST_DAY"
  | "BIG_WIN_DEPENDENCY"
  | "LOSS_VS_WIN"
  | "STALE_PROFILE"
  | "RECOVERY";

export type RiskSeverity = "INFO" | "WARNING" | "CRITICAL";

export type FreshnessStatusInput = "fresh" | "getting_stale" | "stale" | "manual_only" | "never";

export interface RiskEventInput {
  type: RiskEventType;
  severity: RiskSeverity;
  title: string;
  description: string;
  metricBefore?: number | null;
  metricAfter?: number | null;
  isClientVisible: boolean;
}

const pct = (n: number) => `${n.toFixed(1)}%`;

/** Derive the risk events to persist for this publish. */
export function generateRiskEvents(
  trust: TrustMetrics,
  diff: VersionDiff,
  freshness: FreshnessStatusInput,
): RiskEventInput[] {
  const events: RiskEventInput[] = [];
  const m = trust.metrics;

  // Drawdown — severity from the shared threshold ladder.
  if (m.maxDrawdownPct > 0) {
    const sev = drawdownSeverity(m.maxDrawdownPct);
    const severity: RiskSeverity =
      sev === "severe" ? "CRITICAL" : sev === "high" ? "CRITICAL" : sev === "elevated" ? "WARNING" : "INFO";
    events.push({
      type: "DRAWDOWN",
      severity,
      title: `Largest drawdown ${pct(m.maxDrawdownPct)}`,
      description: `The deepest peak-to-trough decline in this record was ${pct(m.maxDrawdownPct)} (${formatMoney(m.maxDrawdown)}).`,
      metricAfter: m.maxDrawdownPct,
      isClientVisible: true,
    });
  }

  // Worst single day — warn when it dwarfs the typical losing day.
  if (m.worstDay < 0) {
    const typical = Math.abs(m.avgRedDay);
    const severe = typical > 0 && Math.abs(m.worstDay) > typical * 2.5;
    events.push({
      type: "WORST_DAY",
      severity: severe ? "WARNING" : "INFO",
      title: `Worst day ${formatMoney(m.worstDay)}`,
      description: severe
        ? `The single worst day (${formatMoney(m.worstDay)}) was much larger than the typical losing day (${formatMoney(-typical)}).`
        : `The single worst day in this record was ${formatMoney(m.worstDay)}.`,
      metricAfter: m.worstDay,
      isClientVisible: true,
    });
  }

  // Big-win dependency — how much of the profit leans on one day.
  if (trust.bestDayShare != null && m.netPnl > 0) {
    const share = trust.bestDayShare;
    if (share > 0.4) {
      events.push({
        type: "BIG_WIN_DEPENDENCY",
        severity: share > 0.6 ? "CRITICAL" : "WARNING",
        title: `Best day is ${pct(share * 100)} of profit`,
        description: `${pct(share * 100)} of the net profit came from a single day — results depend heavily on one outlier.`,
        metricAfter: share,
        isClientVisible: true,
      });
    }
  }

  // Loss-vs-win sizing.
  if (trust.badToGoodRatio != null && trust.badToGoodRatio > 1) {
    events.push({
      type: "LOSS_VS_WIN",
      severity: trust.badToGoodRatio > 1.5 ? "WARNING" : "INFO",
      title: "Losing days bigger than winning days",
      description: `The average losing day is ${trust.badToGoodRatio.toFixed(2)}× the average winning day.`,
      metricAfter: trust.badToGoodRatio,
      isClientVisible: true,
    });
  }

  // Recovery — drawdown got shallower vs last version.
  if (!diff.isFirst && diff.drawdownPctDelta <= -2) {
    events.push({
      type: "RECOVERY",
      severity: "INFO",
      title: "Drawdown recovered",
      description: `The largest drawdown narrowed by ${pct(Math.abs(diff.drawdownPctDelta))} since the last update.`,
      metricAfter: m.maxDrawdownPct,
      isClientVisible: true,
    });
  }

  // Stale profile (only when actually stale — normally set by the freshness check).
  if (freshness === "stale") {
    events.push({
      type: "STALE_PROFILE",
      severity: "WARNING",
      title: "Profile is stale",
      description: "This profile has not been refreshed within its chosen update cadence — treat results as historical only.",
      isClientVisible: true,
    });
  }

  return events;
}

/** One-line plain-English summary of what changed since the previous version. */
export function buildChangeSummary(trust: TrustMetrics, diff: VersionDiff): string {
  const m = trust.metrics;
  if (diff.isFirst) {
    return `First published update — ${m.tradingDays} trading days through ${diff.newDaysCovered ? "the stated coverage date" : "the imported record"}, net ${formatMoney(m.netPnl)}.`;
  }

  const parts: string[] = [];
  if (diff.newDaysCovered) parts.push("added new trading days");
  if (Math.abs(diff.netPnlDelta) >= 0.01) {
    parts.push(`net P&L ${diff.netPnlDelta >= 0 ? "+" : ""}${formatMoney(diff.netPnlDelta)}`);
  }
  if (Math.abs(diff.drawdownPctDelta) >= 0.1) {
    parts.push(`max drawdown ${diff.drawdownPctDelta > 0 ? "deeper" : "narrower"} by ${pct(Math.abs(diff.drawdownPctDelta))}`);
  }

  if (parts.length === 0) return "Re-published with no material change to the performance record.";
  return `Since the last update: ${parts.join(", ")}.`;
}
