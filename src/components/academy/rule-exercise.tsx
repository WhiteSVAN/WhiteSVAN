"use client";

import { useState } from "react";
import { FlaskConical, Minus, Plus, RotateCcw } from "lucide-react";
import { EVALUATION_PLANS, PROGRAMME_RULES as R, type EvaluationPlan } from "@/lib/prop-firm";
import {
  MAX_PRACTICE_DAYS, PRACTICE_SCENARIOS, parsePracticeAmount, reviewPracticeWeek, scenarioAmounts,
  type PracticeReview, type PracticeRow,
} from "@/lib/academy-practice";
import { formatPaise } from "@/lib/trading/money";

const CUSTOM = "custom";
const money = (paise: number) => formatPaise(paise, paise % 100 === 0 ? 0 : 2);
const asInput = (paise: number) => String(paise / 100);
const amountsFor = (scenarioId: string, plan: EvaluationPlan) =>
  scenarioAmounts(PRACTICE_SCENARIOS.find((item) => item.id === scenarioId) ?? PRACTICE_SCENARIOS[0], plan).map(asInput);

export function RuleExercise() {
  const [planId, setPlanId] = useState<string>(EVALUATION_PLANS[0].id);
  const [scenarioId, setScenarioId] = useState<string>(PRACTICE_SCENARIOS[0].id);
  const [entries, setEntries] = useState<string[]>(() => amountsFor(PRACTICE_SCENARIOS[0].id, EVALUATION_PLANS[0]));
  const plan = EVALUATION_PLANS.find((item) => item.id === planId) ?? EVALUATION_PLANS[0];
  const scenario = PRACTICE_SCENARIOS.find((item) => item.id === scenarioId);

  const amounts = entries.map((entry) => {
    const paise = parsePracticeAmount(entry);
    return paise !== null && Math.abs(paise) <= plan.balance * 100 ? paise : null;
  });
  const review = amounts.every((amount) => amount !== null) ? reviewPracticeWeek(plan, amounts as number[]) : null;

  const choosePlan = (id: string) => {
    const next = EVALUATION_PLANS.find((item) => item.id === id) ?? EVALUATION_PLANS[0];
    setPlanId(next.id);
    if (scenarioId !== CUSTOM) setEntries(amountsFor(scenarioId, next));
  };
  const chooseScenario = (id: string) => {
    setScenarioId(id);
    if (id !== CUSTOM) setEntries(amountsFor(id, plan));
  };
  const edit = (index: number, value: string) => {
    setScenarioId(CUSTOM);
    setEntries(entries.map((entry, position) => (position === index ? value : entry)));
  };
  const resize = (delta: 1 | -1) => {
    setScenarioId(CUSTOM);
    setEntries(delta > 0 ? [...entries, "0"] : entries.slice(0, -1));
  };
  const reset = () => {
    setPlanId(EVALUATION_PLANS[0].id);
    setScenarioId(PRACTICE_SCENARIOS[0].id);
    setEntries(amountsFor(PRACTICE_SCENARIOS[0].id, EVALUATION_PLANS[0]));
  };

  const rules = review?.rules;
  const field = "mt-2 min-h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 text-sm text-[var(--foreground)]";

  return (
    <section className="terminal-card overflow-hidden" aria-labelledby="exercise-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7">
        <span className="terminal-label flex items-center gap-2"><FlaskConical className="h-4 w-4" aria-hidden="true" /> Rule practice</span>
        <span className="text-xs text-[var(--muted)]">{R.version} rules</span>
      </div>
      <div className="p-5 sm:p-7">
        <h3 id="exercise-title" className="text-2xl font-medium tracking-tight">Run the rules on a sample week.</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">Pick an account size and a sample week, or type your own daily results. Each row is one trading day&apos;s closing P&amp;L after costs. The table applies the profit target, the daily loss limit, the trailing drawdown and the consistency rule, day by day.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-[var(--muted)]" htmlFor="practice-plan">Account size
            <select id="practice-plan" value={planId} onChange={(event) => choosePlan(event.target.value)} className={field}>
              {EVALUATION_PLANS.map((item) => <option key={item.id} value={item.id}>{item.label} account</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--muted)]" htmlFor="practice-scenario">Sample week
            <select id="practice-scenario" value={scenarioId} onChange={(event) => chooseScenario(event.target.value)} className={field}>
              {PRACTICE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              <option value={CUSTOM}>Your own days</option>
            </select>
          </label>
        </div>
        {rules && <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] text-xs sm:grid-cols-5">
          {[
            ["Profit target", money(rules.profitTarget)],
            ["Max drawdown", `${money(rules.maxLoss)} trailing`],
            ["Daily loss limit", money(rules.dailyLoss)],
            ["Minimum days", String(rules.minTradingDays)],
            ["Best day", `≤ ${rules.consistencyPercent}% of profit`],
          ].map(([label, value]) => <div key={label} className="bg-[var(--card-deep)] px-4 py-3"><dt className="text-[var(--muted)]">{label}</dt><dd className="mt-1 font-mono text-[var(--foreground)]">{value}</dd></div>)}
        </dl>}
        <p className="mt-4 text-sm text-[var(--foreground)]">{scenario ? scenario.description : "Your own results: edit any day, or add and remove days."}</p>

        {/* Wide screens: a table. Phones: one card per day. Both edit the same entries. */}
        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-[var(--border)] sm:block">
          <table className="w-full min-w-[640px] text-left text-xs tabular-nums">
            <caption className="sr-only">Daily results and rule checks for the sample account</caption>
            <thead className="border-b border-[var(--border)] bg-[var(--card-deep)] text-[var(--muted)]">
              <tr>{["Day", "Day P&L (₹)", "Balance", "Drawdown floor", "Daily loss used", "Result"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((entry, index) => {
                const row: PracticeRow | undefined = review?.rows[index];
                const invalid = amounts[index] === null;
                return <tr key={index} className={review && !row ? "opacity-50" : undefined}>
                  <th scope="row" className="px-4 py-3 font-mono font-normal">{String(index + 1).padStart(2, "0")}</th>
                  <td className="px-4 py-2">
                    <label className="sr-only" htmlFor={`practice-day-${index}`}>Day {index + 1} P&amp;L in rupees</label>
                    <input id={`practice-day-${index}`} inputMode="decimal" value={entry} onChange={(event) => edit(index, event.target.value)} aria-invalid={invalid} className={`w-28 ${dayInputClass(invalid, amounts[index])}`} />
                  </td>
                  <td className="px-4 py-3 font-mono">{row ? money(row.balance) : "—"}</td>
                  <td className="px-4 py-3 font-mono">{row ? money(row.floor) : "—"}</td>
                  <td className="px-4 py-3 font-mono">{row ? money(row.dailyLossUsed) : "—"}</td>
                  <td className={`px-4 py-3 ${resultClass(row)}`}>{rowResult(row, invalid, review)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <ol className="mt-4 space-y-3 sm:hidden" aria-label="Daily results and rule checks for the sample account">
          {entries.map((entry, index) => {
            const row: PracticeRow | undefined = review?.rows[index];
            const invalid = amounts[index] === null;
            return <li key={index} className={`rounded-lg border border-[var(--border)] p-4 ${review && !row ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`practice-day-card-${index}`} className="font-mono text-xs text-[var(--muted)]">Day {String(index + 1).padStart(2, "0")} P&amp;L (₹)</label>
                <span className={`text-xs ${resultClass(row)}`}>{rowResult(row, invalid, review)}</span>
              </div>
              <input id={`practice-day-card-${index}`} inputMode="decimal" value={entry} onChange={(event) => edit(index, event.target.value)} aria-invalid={invalid} className={`mt-2 w-full ${dayInputClass(invalid, amounts[index])}`} />
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                {([["Balance", row?.balance], ["Floor", row?.floor], ["Loss used", row?.dailyLossUsed]] as const).map(([label, value]) => <div key={label}><dt className="text-[var(--muted)]">{label}</dt><dd className="mt-1 font-mono">{value === undefined ? "—" : money(value)}</dd></div>)}
              </dl>
            </li>;
          })}
        </ol>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => resize(1)} disabled={entries.length >= MAX_PRACTICE_DAYS} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-xs hover:bg-[var(--card-raised)] disabled:opacity-40"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a day</button>
          <button type="button" onClick={() => resize(-1)} disabled={entries.length <= 1} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-xs hover:bg-[var(--card-raised)] disabled:opacity-40"><Minus className="h-3.5 w-3.5" aria-hidden="true" /> Remove the last day</button>
        </div>

        <div aria-live="polite" aria-atomic="true" className="mt-5">
          {review ? <Outcome review={review} /> : <p role="alert" className="rounded-md border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">Enter each day as rupees with up to two decimals, within the account size. Use a minus sign for a loss.</p>}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
          <p className="max-w-2xl text-xs leading-6 text-[var(--muted)]">This uses each day&apos;s close. In an evaluation the daily loss limit and the drawdown also count open P&amp;L during the day, so a position can hit a limit before it closes.</p>
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-xs text-[var(--foreground)] hover:bg-[var(--card-raised)]"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset</button>
        </div>
      </div>
    </section>
  );
}

function dayInputClass(invalid: boolean, amount: number | null): string {
  const border = invalid ? "border-[var(--danger)]" : "border-[var(--border-strong)]";
  const tone = !invalid && (amount ?? 0) < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]";
  return `rounded-md border bg-[var(--card-deep)] px-2 py-2 font-mono text-xs ${border} ${tone}`;
}

function resultClass(row: PracticeRow | undefined): string {
  return row?.breaches.length ? "text-[var(--danger)]" : row?.passed ? "text-[var(--primary)]" : "text-[var(--muted)]";
}

function rowResult(row: PracticeRow | undefined, invalid: boolean, review: PracticeReview | null): string {
  if (invalid) return "Enter an amount";
  if (!row) return review?.status === "PASSED" ? "Already passed" : review?.status === "FAILED" ? "Account ended" : "—";
  if (row.breaches.length > 0) return row.breaches.map((rule) => (rule === "DAILY_LOSS" ? "Daily loss limit hit" : "Drawdown floor hit")).join(" · ");
  return row.passed ? "Passed" : "Inside the rules";
}

function Outcome({ review }: { review: PracticeReview }) {
  const { rules } = review;
  if (review.status === "PASSED") {
    return <div className="rounded-lg border border-[var(--primary)]/50 p-4 text-sm">
      <p className="font-medium text-[var(--primary)]">Passed on day {review.decidedOn}.</p>
      <p className="mt-2 text-[var(--muted)]">Profit {money(review.profit)} over {review.tradingDays} trading days, with a best day of {money(review.bestDay)} (the most allowed was {money(review.bestDayAllowed)}). Next: KYC and your funded account.</p>
    </div>;
  }
  if (review.status === "FAILED") {
    const row = review.rows[review.rows.length - 1];
    const daily = row.breaches.includes("DAILY_LOSS");
    return <div className="rounded-lg border border-[var(--danger)]/50 p-4 text-sm">
      <p className="font-medium text-[var(--danger)]">{daily ? "Daily loss limit" : "Max drawdown"} hit on day {review.decidedOn}.</p>
      <p className="mt-2 text-[var(--muted)]">{daily
        ? `The day lost ${money(row.dailyLossUsed)}, reaching the ${money(rules.dailyLoss)} limit.`
        : `The balance closed at ${money(row.balance)}, at or below the ${money(row.floor)} floor. The floor trails your highest closing balance by ${money(rules.maxLoss)} and stops at your starting balance.`} The account ends there.</p>
    </div>;
  }
  const left: string[] = [];
  if (review.targetLeft > 0) left.push(`${money(review.targetLeft)} more profit`);
  if (review.daysLeft > 0) left.push(`${review.daysLeft} more trading day${review.daysLeft === 1 ? "" : "s"}`);
  if (review.targetLeft === 0 && review.bestDay > review.bestDayAllowed) {
    left.push(`total profit of ${money(review.profitForConsistency)}, so your ${money(review.bestDay)} best day is no more than ${rules.consistencyPercent}% of it`);
  }
  return <div className="rounded-lg border border-[var(--border-strong)] p-4 text-sm">
    <p className="font-medium">Still inside the rules{review.tradingDays > 0 ? ` after ${review.tradingDays} day${review.tradingDays === 1 ? "" : "s"}` : ""}.</p>
    <p className="mt-2 text-[var(--muted)]">{left.length > 0 ? `To pass you need ${left.join(" and ")}.` : "Add a day to keep going."}</p>
  </div>;
}
