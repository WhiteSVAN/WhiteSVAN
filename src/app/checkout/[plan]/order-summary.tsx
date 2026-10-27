import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { CheckoutMode } from "@/lib/checkout/config";
import { formatInr, planLimits, type EvaluationPlan } from "@/lib/prop-firm";

/** The order summary beside checkout, for whichever size is selected: its price and its numbers. The rules are on /rules. */
export function OrderSummary({ plan, mode }: { plan: EvaluationPlan; mode: CheckoutMode }) {
  const limits = planLimits(plan);
  const summary: [string, string][] = [
    ["Account size", formatInr(plan.balance)],
    ["Profit target", formatInr(limits.profitTarget)],
    ["Daily loss limit", formatInr(limits.dailyLoss)],
    ["Max drawdown, end of day", formatInr(limits.maximumLoss)],
    ["Max position", `${plan.lots} ${plan.lots === 1 ? "lot" : "lots"}`],
  ];

  return (
    <aside className="terminal-card p-6 sm:p-8 lg:sticky lg:top-24" aria-labelledby="summary-title">
      <p id="summary-title" className="terminal-label">Order summary</p>
      <div className="mt-4 flex items-baseline justify-between gap-4" aria-live="polite">
        <p className="text-lg font-semibold">{plan.label} evaluation</p>
        {mode === "free" ? (
          <p className="display text-3xl"><s className="mr-2 text-lg text-[var(--muted)]"><span className="sr-only">Fee </span>{formatInr(plan.fee)}</s>{formatInr(0)}</p>
        ) : (
          <p className="display text-3xl">{formatInr(plan.fee)}</p>
        )}
      </div>
      <p className="mt-1 text-right text-xs text-[var(--muted)]">{mode === "free" ? "No payment taken" : mode === "test" ? "Test purchase · not charged" : "One-time · GST included · no activation fee"}</p>
      <dl className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
        {summary.map(([term, value]) => <div key={term} className="flex justify-between gap-4 py-3"><dt className="text-[var(--muted)]">{term}</dt><dd className="font-mono text-xs sm:text-sm">{value}</dd></div>)}
      </dl>
      <Link href="/rules" target="_blank" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">Every rule, in plain words <ArrowRight size={14} aria-hidden="true" /></Link>
      <p className="mt-6 flex gap-2.5 text-xs leading-5 text-[var(--muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />No deposit, and no real money traded. Payouts on funded accounts are real.</p>
    </aside>
  );
}
