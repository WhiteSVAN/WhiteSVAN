"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { EVALUATION_PLANS, PROGRAMME_RULES as R, type EvaluationPlan } from "@/lib/prop-firm";
import { formatPaise, parseRupees } from "@/lib/trading/money";
import { payoutAmounts, profitForFullPayout } from "@/lib/trading/payouts";
import { ruleSetFor } from "@/lib/trading/rules";

const money = (paise: number) => formatPaise(paise, paise % 100 === 0 ? 0 : 2);
/** A starting example: 12% profit, which reaches the cap and leaves profit for the next request. */
const exampleProfit = (plan: EvaluationPlan) => String((plan.balance * 12) / 100);

export function PayoutCalculator() {
  const [planId, setPlanId] = useState<string>(EVALUATION_PLANS[0].id);
  const [profitInput, setProfitInput] = useState(() => exampleProfit(EVALUATION_PLANS[0]));
  const [edited, setEdited] = useState(false);
  const plan = EVALUATION_PLANS.find((item) => item.id === planId) ?? EVALUATION_PLANS[0];
  const rules = ruleSetFor(plan);
  const profit = parseRupees(profitInput);
  const amounts = profit === null ? null : payoutAmounts(rules, profit);
  const field = "mt-2 min-h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 text-sm text-[var(--foreground)]";

  const choosePlan = (id: string) => {
    const next = EVALUATION_PLANS.find((item) => item.id === id) ?? EVALUATION_PLANS[0];
    setPlanId(next.id);
    if (!edited) setProfitInput(exampleProfit(next));
  };

  return (
    <section id="calculator" className="terminal-card scroll-mt-28 overflow-hidden" aria-labelledby="calculator-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7">
        <span className="terminal-label flex items-center gap-2"><Calculator className="h-4 w-4" aria-hidden="true" /> Payout calculator</span>
        <span className="text-xs text-[var(--muted)]">{R.contractorSharePercent}% profit split</span>
      </div>
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <h3 id="calculator-title" className="text-2xl font-medium tracking-tight">Work out a payout.</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Pick your account size and the profit on your funded account. The calculator applies the buffer, the split and the cap for one payout.</p>
          <div className="mt-6 grid gap-4">
            <label className="text-xs text-[var(--muted)]" htmlFor="payout-plan">Account size
              <select id="payout-plan" value={planId} onChange={(event) => choosePlan(event.target.value)} className={field}>
                {EVALUATION_PLANS.map((item) => <option key={item.id} value={item.id}>{item.label} account</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--muted)]" htmlFor="payout-profit">Profit on your funded account (₹)
              <input id="payout-profit" inputMode="decimal" value={profitInput} onChange={(event) => { setEdited(true); setProfitInput(event.target.value); }} aria-invalid={profit === null} aria-describedby="payout-profit-help" className={`${field} font-mono`} />
            </label>
            <p id="payout-profit-help" className="text-xs leading-6 text-[var(--muted)]">A full {money(rules.payoutCap)} payout on this account needs {money(profitForFullPayout(rules))} of profit.</p>
          </div>
        </div>
        <div aria-live="polite" aria-atomic="true">
          {amounts ? <>
            <dl className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
              {[
                ["Buffer that stays in the account", money(amounts.buffer)],
                ["Profit above the buffer", money(amounts.withdrawableProfit)],
                [`Your ${R.contractorSharePercent}% share`, money(amounts.traderShare)],
                ["Payout cap on this account", money(rules.payoutCap)],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="text-[var(--muted)]">{label}</dt><dd className="font-mono">{value}</dd></div>)}
              <div className="flex items-center justify-between gap-4 bg-[var(--card-raised)] px-4 py-4"><dt className="font-medium">Your payout this cycle</dt><dd className="font-mono text-xl text-[var(--primary)]">{money(amounts.payout)}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-6 text-[var(--muted)]">{amounts.payout > 0
              ? `The payout takes ${money(amounts.debit)} of profit off your balance (your share and the firm's)${amounts.withdrawableProfit > amounts.debit ? `, leaving ${money(amounts.withdrawableProfit - amounts.debit)} above the buffer for your next request` : " and leaves the buffer in place"}.`
              : `Payouts start once your profit is above the ${money(amounts.buffer)} buffer.`} Before tax deducted at source, where it applies.</p>
          </> : <p role="alert" className="rounded-md border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">Enter the profit in rupees, up to two decimals.</p>}
        </div>
      </div>
    </section>
  );
}
