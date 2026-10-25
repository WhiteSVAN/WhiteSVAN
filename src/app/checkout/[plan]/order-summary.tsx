import { Check, ShieldCheck } from "lucide-react";
import type { CheckoutMode } from "@/lib/checkout/config";
import { formatInr, planLimits, PROGRAMME_RULES as R, type EvaluationPlan } from "@/lib/prop-firm";

/** The order summary beside checkout, for whichever size is selected. */
export function OrderSummary({ plan, mode }: { plan: EvaluationPlan; mode: CheckoutMode }) {
  const limits = planLimits(plan);
  const summary: [string, string][] = [
    ["Account size", formatInr(plan.balance)],
    ["Profit target", `${formatInr(limits.profitTarget)} (${R.targetPercent}%)`],
    ["Max drawdown, end of day", `${formatInr(limits.maximumLoss)} (${R.maximumLossPercent}%)`],
    ["Daily loss limit", `${formatInr(limits.dailyLoss)} (${R.dailyLossPercent}%)`],
    ["Minimum trading days", String(R.minimumDays)],
    ["Max position", `${plan.lots} ${plan.lots === 1 ? "lot" : "lots"}`],
    ["Profit split when funded", `${R.contractorSharePercent}%`],
    ["Payout cap", `${formatInr(plan.payoutCap)} per request`],
    ["Activation fee", "None"],
  ];

  return (
    <aside className="rounded-2xl border border-[var(--border-strong)] bg-[var(--card-deep)] p-6 sm:p-8 lg:sticky lg:top-28" aria-labelledby="summary-title">
      <p id="summary-title" className="terminal-label">Order summary</p>
      <div className="mt-5 flex items-baseline justify-between gap-4" aria-live="polite">
        <p className="text-lg font-medium">{plan.label} evaluation</p>
        <p className="text-3xl font-medium tracking-[-.04em]">{formatInr(plan.fee)}</p>
      </div>
      <p className="mt-1 text-right text-xs text-[var(--muted)]">{mode === "demo" ? "Paid with demo credit · nobody is charged" : "One-time · GST included"}</p>
      <dl className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)] text-xs">
        {summary.map(([term, value]) => <div key={term} className="flex justify-between gap-4 py-3"><dt className="text-[var(--muted)]">{term}</dt><dd className={term === "Activation fee" ? "text-[var(--primary)]" : ""}>{value}</dd></div>)}
      </dl>
      <ul className="mt-6 space-y-2.5 text-xs leading-5 text-[var(--muted)]">
        {["NIFTY, BANK NIFTY and SENSEX options", "Intraday: positions close at 15:20 IST", `When you pass, your best day is at most ${R.consistencyPercent}% of your profit`].map((item) => (
          <li key={item} className="flex gap-2.5"><Check size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />{item}</li>
        ))}
      </ul>
      <p className="mt-6 flex gap-2.5 text-[11px] leading-5 text-[var(--faint)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Evaluation and funded accounts are simulated. No deposit, no real money traded. Payouts on funded accounts are real.</p>
    </aside>
  );
}
