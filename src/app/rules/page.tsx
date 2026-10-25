import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEMO_CHECKOUT, DEMO_CREDIT } from "@/lib/checkout/demo";
import { EVALUATION_PLANS, formatInr, planLimits, PROGRAMME_RULES as R, RULE_SECTIONS } from "@/lib/prop-firm";

export const metadata: Metadata = {
  title: "Trading rules | WhiteSVAN",
  description: "WhiteSVAN evaluation and funded account rules: profit target, end-of-day drawdown, daily loss limit, trading hours, products and payouts.",
};

export default function RulesPage() {
  const smallest = EVALUATION_PLANS[0];
  const smallestLimits = planLimits(smallest);
  const rows = [
    { label: "Evaluation fee (one-time, incl. GST)", values: EVALUATION_PLANS.map((p) => formatInr(p.fee)) },
    { label: `Profit target (${R.targetPercent}%)`, values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).profitTarget)) },
    { label: `Max drawdown (${R.maximumLossPercent}%, end of day)`, values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).maximumLoss)) },
    { label: `Daily loss limit (${R.dailyLossPercent}%)`, values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).dailyLoss)) },
    { label: "Max position", values: EVALUATION_PLANS.map((p) => `${p.lots} ${p.lots === 1 ? "lot" : "lots"}`) },
    { label: "Min trading days", values: EVALUATION_PLANS.map(() => String(R.minimumDays)) },
    { label: "Consistency (best day)", values: EVALUATION_PLANS.map(() => `${R.consistencyPercent}%`) },
    { label: "Profit split (funded)", values: EVALUATION_PLANS.map(() => `${R.contractorSharePercent}%`) },
    { label: "Payout cap per request", values: EVALUATION_PLANS.map((p) => formatInr(p.payoutCap)) },
  ];
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24"><p className="terminal-label flex items-center gap-2 text-[var(--primary)]"><FileCheck2 size={14} aria-hidden="true" /> Trading rules · {R.version}</p><h1 className="mt-5 text-5xl font-medium leading-[1.05] tracking-[-.055em] sm:text-7xl">The rules.</h1><p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">Everything that decides a pass, a breach and a payout, on one page. The same rules for every account size.</p></div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Compare accounts</h2><Link href="/evaluations#accounts" className="inline-flex items-center gap-2 text-sm text-[var(--primary)]">See pricing <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><caption className="sr-only">Evaluation fees, limits and payout terms for each account size.</caption><thead className="bg-[var(--card-raised)]"><tr><th scope="col" className="p-5 text-xs font-normal text-[var(--muted)]">Account size</th>{EVALUATION_PLANS.map((plan) => <th key={plan.id} scope="col" className="p-5 text-xl font-medium text-[var(--primary)]">{plan.label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{rows.map((row) => <tr key={row.label} className="bg-[var(--card)]"><th scope="row" className="p-5 text-xs font-normal text-[var(--muted)]">{row.label}</th>{row.values.map((value, index) => <td key={index} className="whitespace-nowrap px-5 py-4 text-xs font-medium">{value}</td>)}</tr>)}</tbody></table></div>
        <p className="mt-4 text-xs leading-6 text-[var(--muted)]">Account sizes are simulated balances. All accounts are intraday only and trade NIFTY, BANK NIFTY and SENSEX futures and options.</p>

        <div className="mt-16 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside><nav aria-label="Rules contents" className="sticky top-28 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="terminal-label mb-4">On this page</p><ol className="space-y-3">{RULE_SECTIONS.map((section, index) => <li key={section.id}><a href={`#${section.id}`} className="flex items-center gap-3 text-xs leading-5 text-[var(--muted)] hover:text-[var(--primary)]"><span className="font-mono text-[10px] text-[var(--primary)]">0{index + 1}</span>{section.label}</a></li>)}</ol></nav></aside>
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{RULE_SECTIONS.map((section, index) => <section key={section.id} id={section.id} className="scroll-mt-28 py-8 first:pt-7"><p className="font-mono text-[11px] text-[var(--primary)]">0{index + 1} · {section.label}</p><h2 className="mt-3 text-2xl font-medium tracking-tight">{section.title}</h2><p className="mt-4 text-sm leading-8 text-[var(--muted)]">{section.description}</p>{section.id === "drawdown" && <div className="mt-6 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-5"><p className="text-sm font-medium">Example: {smallest.label} account</p><p className="mt-3 text-xs leading-7 text-[var(--muted)]">You start at {formatInr(smallest.balance)}, so your drawdown floor is {formatInr(smallest.balance - smallestLimits.maximumLoss)}. End a day at {formatInr(smallest.balance + 2_000)} and the floor moves up to {formatInr(smallest.balance + 2_000 - smallestLimits.maximumLoss)}. Once you close a day at {formatInr(smallest.balance + smallestLimits.maximumLoss)}, the floor locks at {formatInr(smallest.balance)} and stops moving. The {formatInr(smallestLimits.dailyLoss)} daily loss limit applies separately.</p><Link href="/academy?tab=evaluations#academy-content" className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--primary)]">Practise the drawdown rules <ArrowRight size={14} aria-hidden="true" /></Link></div>}</section>)}</div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-7 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-7 sm:flex-row sm:items-center sm:p-9"><div className="max-w-2xl"><ShieldCheck className="text-[var(--primary)]" size={25} aria-hidden="true" /><h2 className="mt-4 text-2xl font-medium tracking-tight">Ready? Start your evaluation.</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{DEMO_CHECKOUT ? `Pay with ${formatInr(DEMO_CREDIT)} of virtual credit while payments launch. Rules can change before launch.` : "We're launching soon, and rules can change before launch."}</p></div><Link href="/checkout" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
