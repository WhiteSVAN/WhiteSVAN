"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { EVALUATION_PLANS, formatInr, planLimits, PROGRAMME_RULES as R, RECOMMENDED_PLAN, RULE_GROUPS, rulesInBrief, type EvaluationPlan } from "@/lib/prop-firm";

/** The trading day the hours rule describes, in IST. */
const TRADING_DAY = [
  { time: R.marketOpen, title: "Market opens", text: "Orders open. Both loss limits count open and closed P&L all day." },
  { time: R.squareOff, title: "Square-off", text: "Anything still open is closed for you and working orders are cancelled." },
  { time: R.marketClose, title: "Day closes", text: "Your closing balance is recorded, the floor moves up after a new high, and the pass check runs." },
];

function SizeSwitch({ plan, onChange, className = "" }: { plan: EvaluationPlan; onChange: (plan: EvaluationPlan) => void; className?: string }) {
  return (
    <div role="group" aria-label="Show amounts for account size" className={`inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1 ${className}`}>
      {EVALUATION_PLANS.map((size) => (
        <button key={size.id} type="button" aria-pressed={size.id === plan.id} onClick={() => onChange(size)} className={`min-h-9 min-w-16 rounded-full px-4 text-sm font-medium ${size.id === plan.id ? "bg-[var(--ink)] text-[var(--ink-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          {size.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The rulebook for new and experienced traders at once: every rule as a plain sentence with the
 * rupee amounts for the chosen size, then the exact rule. The size changes every amount on the page.
 */
export function RuleBook() {
  const [plan, setPlan] = useState<EvaluationPlan>(RECOMMENDED_PLAN);
  const table: [string, (size: EvaluationPlan) => string][] = [
    ["Starting balance", (size) => formatInr(size.balance)],
    [`Profit target (${R.targetPercent}%)`, (size) => formatInr(planLimits(size).profitTarget)],
    [`Daily loss limit (${R.dailyLossPercent}%)`, (size) => formatInr(planLimits(size).dailyLoss)],
    [`Max drawdown (${R.maximumLossPercent}%, end of day)`, (size) => formatInr(planLimits(size).maximumLoss)],
    ["Max position", (size) => `${size.lots} ${size.lots === 1 ? "lot" : "lots"}`],
    ["Minimum trading days", () => String(R.minimumDays)],
    ["Consistency (best day)", () => `${R.consistencyPercent}%`],
    ["Profit split (funded)", () => `${R.contractorSharePercent}%`],
    ["Payout cap", (size) => formatInr(size.payoutCap)],
  ];

  return (
    <>
      <section aria-labelledby="brief-title" className="terminal-card p-6 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="brief-title" className="display text-2xl sm:text-3xl">The rules in one minute</h2>
          <SizeSwitch plan={plan} onChange={setPlan} />
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">On a {formatInr(plan.balance)} account. Pick a size to see its amounts everywhere on this page.</p>
        <ol className="mt-7 grid gap-4 md:grid-cols-3">
          {rulesInBrief(plan).map((item, index) => (
            <li key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-5">
              <p className="font-mono text-xs text-[var(--primary)]">{index + 1}</p>
              <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm leading-6 text-[var(--muted)]">The platform takes care of the rest: options only, up to {plan.lots} {plan.lots === 1 ? "lot" : "lots"} open, and everything closed by {R.squareOff} IST.</p>
      </section>

      <div className="mt-14 grid gap-10 lg:grid-cols-[230px_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <nav aria-label="Rules contents" className="sticky top-24 space-y-6">
            <div>
              <p className="terminal-label mb-2">Amounts for</p>
              <SizeSwitch plan={plan} onChange={setPlan} />
            </div>
            {RULE_GROUPS.map((group) => (
              <div key={group.id}>
                <a href={`#${group.id}`} className="text-sm font-medium hover:text-[var(--primary)]">{group.title}</a>
                <ul className="mt-2 space-y-1.5 border-l border-[var(--border)] pl-3">
                  {group.rules.map((rule) => <li key={rule.id}><a href={`#${rule.id}`} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">{rule.label}</a></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-14">
          {RULE_GROUPS.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border)] pb-4">
                <h2 id={`${group.id}-title`} className="display text-3xl">{group.title}</h2>
                <p className="text-sm text-[var(--muted)]">{group.appliesTo}</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {group.rules.map((rule) => (
                  <article key={rule.id} id={rule.id} className="grid scroll-mt-24 gap-3 py-7 sm:grid-cols-[1fr_auto] sm:gap-x-10">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-[var(--muted)]">{rule.label}</h3>
                      <p className="mt-2 text-lg leading-7">{rule.plain(plan)}</p>
                      <p className="mt-4 text-sm leading-7 text-[var(--muted)]"><span className="font-medium text-[var(--foreground)]">Exact rule. </span>{rule.exact}</p>
                      {rule.example && <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-4 text-sm leading-7 text-[var(--muted)]"><span className="font-medium text-[var(--foreground)]">Example, {plan.label}. </span>{rule.example(plan)}</p>}
                      {rule.id === "sessions" && (
                        <ol className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Your trading day, IST">
                          {TRADING_DAY.map((moment) => (
                            <li key={moment.time} className="rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-4">
                              <p className="font-mono text-sm text-[var(--primary)]">{moment.time}</p>
                              <p className="mt-1 text-sm font-medium">{moment.title}</p>
                              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{moment.text}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <p className="display order-first text-3xl sm:order-none sm:text-right sm:text-4xl">{rule.figure(plan)}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section aria-labelledby="sizes-title" className="scroll-mt-24" id="sizes">
            <h2 id="sizes-title" className="display border-b border-[var(--border)] pb-4 text-3xl">Every size side by side</h2>
            <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <caption className="sr-only">Limits and payout terms for each account size</caption>
                <thead className="bg-[var(--card-raised)]"><tr><th scope="col" className="p-4 text-xs font-normal text-[var(--muted)]">Account size</th>{EVALUATION_PLANS.map((size) => <th key={size.id} scope="col" className={`p-4 text-lg font-medium ${size.id === plan.id ? "text-[var(--primary)]" : ""}`}>{size.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {table.map(([label, value]) => <tr key={label} className="bg-[var(--card)]"><th scope="row" className="p-4 text-xs font-normal text-[var(--muted)]">{label}</th>{EVALUATION_PLANS.map((size) => <td key={size.id} className="whitespace-nowrap px-4 py-3.5 font-mono text-xs">{value(size)}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">Every size has the same rules; only the amounts change.</p>
            <Link href={`/checkout/${plan.id}`} className="prop-button mt-6">Start the {plan.label} evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>
      </div>
    </>
  );
}
