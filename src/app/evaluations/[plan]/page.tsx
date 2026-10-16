import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, planLimits } from "@/lib/prop-firm";

type Props = { params: Promise<{ plan: string }> };

export function generateStaticParams() {
  return EVALUATION_PLANS.map((plan) => ({ plan: plan.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = findEvaluationPlan((await params).plan);
  return { title: plan ? `${plan.label} evaluation preview | WhiteSVAN` : "Account not found | WhiteSVAN" };
}

export default async function EvaluationDetailPage({ params }: Props) {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) notFound();
  const limits = planLimits(plan);
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content" className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14">
      <Link href="/evaluations#accounts" className="inline-flex min-h-10 items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--primary)]"><ArrowLeft size={14} aria-hidden="true" /> All evaluation accounts</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
        <div><p className="terminal-label text-[var(--primary)]">Your account, at a glance</p><h1 className="mt-5 text-5xl font-medium leading-[1.06] tracking-[-.055em] sm:text-7xl">The <span className="text-[var(--primary)]">{plan.label}</span><br />evaluation.</h1><p className="mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">A simulated {formatInr(plan.balance)} account. A clear set of rules. Your opportunity to demonstrate a repeatable trading process.</p>
          <nav aria-label="Select account size" className="mt-7 flex flex-wrap gap-2">{EVALUATION_PLANS.map((tier) => <Link key={tier.id} href={`/evaluations/${tier.id}`} aria-current={tier.id === plan.id ? "page" : undefined} className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-full border px-5 text-sm ${tier.id === plan.id ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}>{tier.label}</Link>)}</nav>
          <div className="mt-10 grid grid-cols-2 gap-3">{[
            ["Profit target", formatInr(limits.profitTarget), "6% of starting balance"],
            ["Maximum loss", formatInr(limits.maximumLoss), "4% · End-of-day trailing"],
            ["Daily loss limit", formatInr(limits.dailyLoss), "2% of starting balance"],
            ["Maximum position", `${plan.lots} ${plan.lots === 1 ? "lot" : "lots"}`, "Across permitted indices"],
          ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] text-[var(--muted)]">{label}</p><p className="mt-3 text-2xl font-medium tracking-tight">{value}</p><p className="mt-2 text-[10px] leading-5 text-[var(--faint)]">{detail}</p></div>)}</div>
          <ul className="mt-7 space-y-3 text-xs leading-6 text-[var(--muted)]">{["Minimum five trading days; best day ≤50% of total profit at passing.", "Intraday only. Flatten positions at 15:20 IST.", "NIFTY, BANK NIFTY and SENSEX futures and options.", "Defined-risk short-option spreads only; no uncovered short options.", "Maximum three active evaluation or Level 1 accounts per person."].map((item) => <li key={item} className="flex items-start gap-3"><Check size={14} className="mt-1 shrink-0 text-[var(--primary)]" aria-hidden="true" />{item}</li>)}</ul>
          <Link href="/rules" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">View the complete draft rulebook <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <aside className="self-start rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-6 sm:p-8 lg:sticky lg:top-28"><div className="flex items-center justify-between gap-3"><p className="terminal-label">Evaluation preview</p><span className="rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[10px] text-[var(--primary)]">Not yet on sale</span></div><div className="mt-8 flex items-baseline gap-2"><p className="text-5xl font-medium tracking-[-.05em]">{formatInr(plan.fee)}</p><span className="text-sm text-[var(--muted)]">one time</span></div><p className="mt-3 text-xs text-[var(--muted)]">Proposed evaluation fee · GST included</p><dl className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)] text-xs"><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Simulated balance</dt><dd>{formatInr(plan.balance)}</dd></div><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Recurring subscription</dt><dd>None in the draft model</dd></div><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Payment due now</dt><dd className="text-[var(--primary)]">₹0 · Preview only</dd></div></dl><div className="mt-6 flex items-start gap-3"><ShieldCheck size={20} className="mt-1 shrink-0 text-[var(--primary)]" aria-hidden="true" /><p className="text-xs leading-6 text-[var(--muted)]">Paid evaluations are not open. No payment or evaluation enrolment happens on this page. Final fee, access, retake and refund terms will be available before launch.</p></div><Link href="/academy?tab=evaluations#academy-content" className="mt-7 flex min-h-12 items-center justify-center gap-3 rounded-full bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Try the rule exercise <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/signup" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] px-5 text-sm hover:border-[var(--primary)] hover:text-[var(--primary)]">Create a trader profile <ChevronRight size={15} aria-hidden="true" /></Link><p className="mt-4 text-center text-[10px] leading-5 text-[var(--faint)]">A profile does not activate an evaluation account.</p></aside>
      </div>
      <section className="mt-14 rounded-2xl border border-[var(--border)] bg-[var(--card-deep)] p-7 sm:mt-20 sm:p-9"><p className="terminal-label text-[var(--primary)]">Beyond the evaluation</p><div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.2fr]"><h2 className="text-3xl font-medium leading-tight tracking-[-.04em]">Prove the process.<br /><span className="text-[var(--muted)]">Explore the next step.</span></h2><div><p className="text-sm leading-7 text-[var(--muted)]">The proposed contractor pathway follows a pass, KYC and a separate agreement. Accounts remain simulated. Draft compensation is 80% of eligible simulated net profit, with a {formatInr(plan.payoutCap)} cap per cycle for this tier, a retained profit buffer of {formatInr(limits.maximumLoss)}, and twice-monthly review.</p><p className="mt-4 text-xs leading-6 text-[var(--muted)]">Passing does not guarantee income. There is no capital deposit from the trader. Any firm copy desk is a separate internal activity and does not turn the contractor account into a live brokerage account.</p><Link href="/rules#desk" className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Understand the pathway <ArrowRight size={15} aria-hidden="true" /></Link></div></div></section>
    </main>
    <SiteFooter />
  </div>;
}
