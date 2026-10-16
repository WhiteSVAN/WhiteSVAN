"use client";

import { useState } from "react";
import { ArrowRight, FlaskConical, RotateCcw } from "lucide-react";
import { PRACTICE_SCENARIOS, parsePracticeLimit, reviewPracticeDays } from "@/lib/academy-practice";

const rupees = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export function RuleExercise() {
  const [scenarioId, setScenarioId] = useState<string>(PRACTICE_SCENARIOS[0].id);
  const [dailyLimit, setDailyLimit] = useState("2000");
  const [drawdownLimit, setDrawdownLimit] = useState("5000");
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === scenarioId) ?? PRACTICE_SCENARIOS[0];
  const dailyValue = parsePracticeLimit(dailyLimit);
  const drawdownValue = parsePracticeLimit(drawdownLimit);
  const result = dailyValue !== null && drawdownValue !== null ? reviewPracticeDays(scenario.dailyNetInr, dailyValue, drawdownValue) : null;
  const inputClass = "mt-2 min-h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 text-sm text-[var(--foreground)]";

  return (
    <section className="terminal-card overflow-hidden" aria-labelledby="exercise-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7">
        <span className="terminal-label flex items-center gap-2"><FlaskConical className="h-4 w-4" aria-hidden="true" /> Classroom / synthetic data</span>
        <span className="text-xs text-[var(--muted)]">No market feed or evaluation score</span>
      </div>
      <div className="p-5 sm:p-7">
        <h3 id="exercise-title" className="text-2xl font-medium tracking-tight">See how a rule changes the review.</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">Explore five fictional sessions starting with a virtual ₹1,00,000. Each row is net closed-trade P&amp;L, including hypothetical costs. Change the example limits and inspect the calculation.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="text-xs text-[var(--muted)]" htmlFor="practice-scenario">Example record
            <select id="practice-scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className={inputClass}>
              {PRACTICE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--muted)]" htmlFor="practice-daily-limit">Daily closed-loss limit / INR
            <input id="practice-daily-limit" type="number" min="0.01" max="100000" step="0.01" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} aria-invalid={dailyValue === null} aria-describedby={dailyValue === null ? "practice-method practice-limits-error" : "practice-method"} className={inputClass} />
          </label>
          <label className="text-xs text-[var(--muted)]" htmlFor="practice-drawdown-limit">End-of-day drawdown limit / INR
            <input id="practice-drawdown-limit" type="number" min="0.01" max="100000" step="0.01" value={drawdownLimit} onChange={(event) => setDrawdownLimit(event.target.value)} aria-invalid={drawdownValue === null} aria-describedby={drawdownValue === null ? "practice-method practice-limits-error" : "practice-method"} className={inputClass} />
          </label>
        </div>
        <p id="practice-method" className="mt-3 text-xs leading-6 text-[var(--muted)]">Example policy: reaching or exceeding either limit breaches that rule. Drawdown is the fall from the highest closing balance, including the starting balance. These are classroom thresholds, not programme terms.</p>
        {!result ? <p id="practice-limits-error" role="alert" className="mt-5 rounded-md border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">Enter each limit between ₹0.01 and ₹1,00,000, using at most two decimal places, to review the example.</p> : (
          <>
            <p className="mt-6 text-sm text-[var(--foreground)]">{scenario.description}</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[570px] text-left text-xs tabular-nums">
                <caption className="sr-only">Fictional session results and example rule checks</caption>
                <thead className="border-b border-[var(--border)] bg-[var(--card-deep)] text-[var(--muted)]"><tr>{["Session", "Net closed P&L", "Virtual close", "EOD drawdown", "Rule review"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.rows.map((row) => <tr key={row.session}>
                    <th scope="row" className="px-4 py-4 font-mono font-normal">0{row.session}</th>
                    <td className={`px-4 py-4 font-mono ${row.netInr < 0 ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{rupees(row.netInr)}</td>
                    <td className="px-4 py-4 font-mono">{rupees(row.balanceInr)}</td>
                    <td className="px-4 py-4 font-mono">{rupees(row.drawdownInr)}</td>
                    <td className={`px-4 py-4 ${row.dailyReached || row.drawdownReached ? "text-[var(--warning)]" : "text-[var(--muted)]"}`}>{[row.dailyReached ? "Daily limit reached" : "", row.drawdownReached ? "EOD limit reached" : ""].filter(Boolean).join(" · ") || "Within example limits"}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] p-4"><p className="terminal-label">Daily loss review</p><p className="mt-2 text-sm">{result.firstDailyBreach ? `Limit first reached in session ${result.firstDailyBreach}.` : "No daily breach in these example rows."}</p><p className="mt-2 text-xs text-[var(--muted)]">Largest closed loss: {rupees(result.worstDayLossInr)}</p></div>
              <div className="rounded-lg border border-[var(--border)] p-4"><p className="terminal-label">End-of-day review</p><p className="mt-2 text-sm">{result.firstDrawdownBreach ? `Limit first reached in session ${result.firstDrawdownBreach}.` : "No EOD breach in these example rows."}</p><p className="mt-2 text-xs text-[var(--muted)]">Largest closing drawdown: {rupees(result.maxDrawdownInr)}</p></div>
            </div>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
          <p className="max-w-2xl text-xs leading-6 text-[var(--muted)]"><ArrowRight className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> A closed-P&amp;L example cannot establish intraday equity, margin or open-position breaches. This exercise does not assess eligibility, award a pass or allocate capital.</p>
          <button type="button" onClick={() => { setScenarioId(PRACTICE_SCENARIOS[0].id); setDailyLimit("2000"); setDrawdownLimit("5000"); }} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-xs text-[var(--foreground)] hover:bg-[var(--card-raised)]"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset example</button>
        </div>
      </div>
    </section>
  );
}
