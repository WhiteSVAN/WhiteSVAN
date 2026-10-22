import { planLimits, type EvaluationPlan } from "./prop-firm";

/** Illustrative history only. These are not customer records or a performance forecast. */
const SAMPLE_PNL_BPS = [-50, 15, 60, 40, 95, 140, 115, 190, 260, 338] as const;

export function programmePreview(plan: EvaluationPlan) {
  const limits = planLimits(plan);
  const series = SAMPLE_PNL_BPS.map((bps, index) => {
    const pnl = Math.round((plan.balance * bps) / 10_000);
    return { day: index + 1, equity: plan.balance + pnl, pnl };
  });
  const last = series[series.length - 1];
  return {
    limits,
    series,
    equity: last.equity,
    pnl: last.pnl,
    targetProgress: Math.min(100, Math.max(0, (last.pnl / limits.profitTarget) * 100)),
  };
}
