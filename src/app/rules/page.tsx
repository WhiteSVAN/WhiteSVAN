import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EVALUATION_PLANS, formatInr, planLimits, RULE_SECTIONS } from "@/lib/prop-firm";

export const metadata: Metadata = {
  title: "Trading rules | WhiteSVAN",
  description: "The proposed WhiteSVAN India evaluation rulebook: targets, daily loss limits, end-of-day drawdown, trading sessions and contractor terms.",
};

export default function RulesPage() {
  const rows = [
    { label: "One-time fee · incl. GST", values: EVALUATION_PLANS.map((p) => formatInr(p.fee)) },
    { label: "Profit target · 6%", values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).profitTarget)) },
    { label: "Maximum loss · 4% EOD trailing", values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).maximumLoss)) },
    { label: "Daily loss limit · 2%", values: EVALUATION_PLANS.map((p) => formatInr(planLimits(p).dailyLoss)) },
    { label: "Maximum position · lots", values: EVALUATION_PLANS.map((p) => String(p.lots)) },
    { label: "Minimum trading days", values: EVALUATION_PLANS.map(() => "5") },
    { label: "Best-day consistency", values: EVALUATION_PLANS.map(() => "50%") },
    { label: "Proposed contractor cycle cap", values: EVALUATION_PLANS.map((p) => formatInr(p.payoutCap)) },
  ];
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <section className="border-b border-[var(--border)] bg-[radial-gradient(ellipse_at_75%_0%,rgba(186,242,119,.07),transparent_60%)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24"><p className="terminal-label flex items-center gap-2 text-[var(--primary)]"><FileCheck2 size={14} aria-hidden="true" /> India rulebook · v1 draft</p><h1 className="mt-5 text-5xl font-medium leading-[1.05] tracking-[-.055em] sm:text-7xl">Trade with clarity.<br /><span className="text-[var(--muted)]">Know every rule.</span></h1><p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">Your evaluation should test your trading, not your ability to find the small print. Compare the proposed limits and understand the path before you begin.</p><p className="mt-5 inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--card)] px-4 py-2 text-[11px] text-[var(--primary)]">Programme preview · Final terms will be published before purchases open</p></div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-medium tracking-tight sm:text-3xl">One set of standards. Four sizes.</h2><Link href="/evaluations#accounts" className="inline-flex items-center gap-2 text-sm text-[var(--primary)]">Compare accounts <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[690px] border-collapse text-left text-sm"><caption className="sr-only">Proposed India v1 account fees and trading limits. All account balances are simulated.</caption><thead className="bg-[var(--card-raised)]"><tr><th scope="col" className="p-5 text-xs font-normal text-[var(--muted)]">Simulated balance</th>{EVALUATION_PLANS.map((plan) => <th key={plan.id} scope="col" className="p-5 text-xl font-medium text-[var(--primary)]">{plan.label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{rows.map((row) => <tr key={row.label} className="bg-[var(--card)]"><th scope="row" className="p-5 text-xs font-normal text-[var(--muted)]">{row.label}</th>{row.values.map((value, index) => <td key={index} className="whitespace-nowrap px-5 py-4 text-xs font-medium">{value}</td>)}</tr>)}</tbody></table></div>
        <p className="mt-4 text-xs leading-6 text-[var(--muted)]">The simulated balance is a risk budget. All account sizes share the rules below. The contractor cycle cap applies after passing, KYC and a separate agreement; it is not a promised payout.</p>

        <div className="mt-16 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside><nav aria-label="Rulebook contents" className="sticky top-28 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="terminal-label mb-4">In this rulebook</p><ol className="space-y-3">{RULE_SECTIONS.map((section, index) => <li key={section.id}><a href={`#${section.id}`} className="flex items-center gap-3 text-xs leading-5 text-[var(--muted)] hover:text-[var(--primary)]"><span className="font-mono text-[10px] text-[var(--primary)]">0{index + 1}</span>{["Evaluation objective", "Loss limits", "Markets & instruments", "Trading session", "Account conduct", "Contractor pathway", "Appeals & fees"][index]}</a></li>)}</ol></nav></aside>
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{RULE_SECTIONS.map((section, index) => <section key={section.id} id={section.id} className="scroll-mt-28 py-8 first:pt-7"><p className="font-mono text-[11px] text-[var(--primary)]">0{index + 1}</p><h2 className="mt-3 text-2xl font-medium tracking-tight">{section.title}</h2><p className="mt-4 text-sm leading-8 text-[var(--muted)]">{section.description}</p>{section.id === "drawdown" && <div className="mt-6 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-5"><p className="text-sm font-medium">A ₹1L account, worked through</p><p className="mt-3 text-xs leading-7 text-[var(--muted)]">Start: ₹1,00,000 balance and ₹96,000 maximum-loss threshold. If the highest end-of-day balance becomes ₹1,02,000, that threshold rises to ₹98,000. At a ₹1,04,000 end-of-day peak, it reaches ₹1,00,000 and then stays there as the balance grows. The ₹2,000 daily loss limit remains a separate rule.</p><Link href="/academy?tab=evaluations#academy-content" className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--primary)]">Explore an educational rule exercise <ArrowRight size={14} aria-hidden="true" /></Link></div>}</section>)}</div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-7 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-7 sm:flex-row sm:items-center sm:p-9"><div className="max-w-2xl"><ShieldCheck className="text-[var(--primary)]" size={25} aria-hidden="true" /><h2 className="mt-4 text-2xl font-medium tracking-tight">Read it. Understand it. Then choose.</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">Paid evaluations and contractor payouts are not active in this preview. The rules, fees, simulator and review process must be final before launch.</p></div><Link href="/evaluations#accounts" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Explore accounts <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
