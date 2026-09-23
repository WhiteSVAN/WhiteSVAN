/**
 * Allocator diligence brief — a private-equity-style read of a trader, built
 * purely from the already-computed TrustMetrics (code-of-record). It reframes the
 * published record for someone evaluating the operator: strengths, risk flags,
 * what to monitor, and data quality.
 *
 * GUARDRAIL: this is a summary of *past* performance only. It must never
 * recommend allocating capital, predict returns, or give investment advice — so
 * every item is descriptive ("the record shows…", "watch whether…"), never
 * prescriptive ("you should invest"). See CLAUDE.md › Guardrails.
 */
import { PROOF_LEVELS, type TrustMetrics } from "@/lib/trust";

export interface DiligenceItem {
  label: string;
  detail: string;
}

export interface DiligenceBrief {
  summary: string;
  strengths: DiligenceItem[];
  risks: DiligenceItem[];
  watchItems: DiligenceItem[];
  dataQuality: { label: string; note: string };
}

/** Fraction (0.12) → "12%". */
function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildDiligenceBrief(trust: TrustMetrics): DiligenceBrief {
  const m = trust.metrics;
  const strengths: DiligenceItem[] = [];
  const risks: DiligenceItem[] = [];
  const watchItems: DiligenceItem[] = [];

  // ── Strengths ──────────────────────────────────────────────
  if (m.returnPct != null && m.returnPct > 0.15) {
    strengths.push({
      label: "Positive period return",
      detail: `+${pct(m.returnPct)} over the period, computed from the imported record.`,
    });
  }
  if (m.winRate >= 0.55) {
    strengths.push({
      label: "High win rate",
      detail: `${pct(m.winRate)} of the ${m.tradingDays} trading days were green.`,
    });
  }
  if (m.maxDrawdownPct < 10) {
    strengths.push({
      label: "Drawdown below 10%",
      detail: `The deepest peak-to-trough decline in this record was ${m.maxDrawdownPct.toFixed(0)}%.`,
    });
  }
  if (m.profitFactor != null && m.profitFactor >= 1.5) {
    strengths.push({
      label: "Healthy profit factor",
      detail: `${m.profitFactor.toFixed(2)}× gross profit to gross loss.`,
    });
  }
  if (trust.bestDayShare != null && trust.bestDayShare < 0.25) {
    strengths.push({
      label: "Broad-based results",
      detail: `Best single day is only ${pct(trust.bestDayShare)} of net profit — not one lucky session.`,
    });
  }
  // ── Risk flags ─────────────────────────────────────────────
  if (m.returnPct != null && m.returnPct < 0) {
    risks.push({
      label: "Negative period return",
      detail: `${pct(m.returnPct)} over the period.`,
    });
  }
  if (trust.drawdownSeverity === "high" || trust.drawdownSeverity === "severe") {
    risks.push({
      label: "Deep drawdown",
      detail: `The deepest peak-to-trough decline was ${m.maxDrawdownPct.toFixed(0)}%.`,
    });
  }
  if (trust.bestDayShare != null && trust.bestDayShare >= 0.4) {
    risks.push({
      label: "Big-win dependency",
      detail: `Best day is ${pct(trust.bestDayShare)} of net profit — results lean on a few sessions.`,
    });
  }
  if (trust.badToGoodRatio != null && trust.badToGoodRatio > 1.2) {
    risks.push({
      label: "Losses outsize wins",
      detail: `The average losing day is ${trust.badToGoodRatio.toFixed(1)}× the average winning day.`,
    });
  }
  if (m.winRate < 0.4) {
    risks.push({
      label: "Low win rate",
      detail: `Only ${pct(m.winRate)} of trading days were green.`,
    });
  }
  if (trust.bounceBackDays == null && trust.daysUnderwater != null) {
    risks.push({
      label: "Unrecovered drawdown",
      detail: `Still ${plural(trust.daysUnderwater, "trading day")} below the prior high at period end.`,
    });
  }
  if (trust.proofLevel <= 2) {
    risks.push({
      label: "Limited verification",
      detail: `${PROOF_LEVELS[trust.proofLevel].label}. Review the source and coverage before relying on the figures.`,
    });
  }

  // ── What to monitor (PE-style ongoing monitoring) ──────────
  if (trust.bestDayShare != null) {
    watchItems.push({
      label: "Concentration",
      detail: `Best day is ${pct(trust.bestDayShare)} of net profit; watch whether returns broaden across more sessions.`,
    });
  }
  watchItems.push({
    label: "Drawdown recovery",
    detail:
      trust.bounceBackDays != null
        ? `Worst drawdown recovered in ${plural(trust.bounceBackDays, "trading day")}; watch recovery speed on the next decline.`
        : `The worst drawdown was not yet recovered in-period; watch for a new equity high.`,
  });
  if (m.tradingDays < 60) {
    watchItems.push({
      label: "Sample size",
      detail: `Only ${plural(m.tradingDays, "trading day")} on record — treat this as an early read.`,
    });
  }

  const summary =
    `This factual review contains ${plural(strengths.length, "positive observation")}, ` +
    `${plural(risks.length, "risk flag")}, and ${plural(watchItems.length, "item")} to monitor. ` +
    `This summarizes past performance only — it is not investment advice or an allocation recommendation.`;

  return {
    summary,
    strengths,
    risks,
    watchItems,
    dataQuality: {
      label: PROOF_LEVELS[trust.proofLevel].label,
      note: PROOF_LEVELS[trust.proofLevel].blurb,
    },
  };
}
