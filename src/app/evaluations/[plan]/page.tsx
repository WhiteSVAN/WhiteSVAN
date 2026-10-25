import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEMO_CHECKOUT } from "@/lib/checkout/demo";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, planLimits, PROGRAMME_RULES as R } from "@/lib/prop-firm";

type Props = { params: Promise<{ plan: string }> };

export function generateStaticParams() {
  return EVALUATION_PLANS.map((plan) => ({ plan: plan.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) return { title: "Account not found | WhiteSVAN" };
  return {
    title: `${plan.label} evaluation | WhiteSVAN`,
    description: `${plan.label} evaluation: ${formatInr(plan.fee)} one-time, ${R.targetPercent}% profit target, end-of-day drawdown and an ${R.contractorSharePercent}% profit split when you're funded.`,
  };
}

export default async function EvaluationDetailPage({ params }: Props) {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) notFound();
  const limits = planLimits(plan);
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content" className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14">
      <Link href="/evaluations#accounts" className="inline-flex min-h-10 items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--primary)]"><ArrowLeft size={14} aria-hidden="true" /> All accounts</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
        <div><p className="terminal-label text-[var(--primary)]">{plan.label} evaluation</p><h1 className="mt-5 text-5xl font-medium leading-[1.06] tracking-[-.055em] sm:text-7xl">The <span className="text-[var(--primary)]">{plan.label}</span><br />evaluation.</h1><p className="mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">Trade a {formatInr(plan.balance)} account with up to {plan.lots} {plan.lots === 1 ? "lot" : "lots"}. Hit {formatInr(limits.profitTarget)} to pass, then keep {R.contractorSharePercent}% of the profit on your funded account.</p>
          <nav aria-label="Select account size" className="mt-7 flex flex-wrap gap-2">{EVALUATION_PLANS.map((tier) => <Link key={tier.id} href={`/evaluations/${tier.id}`} aria-current={tier.id === plan.id ? "page" : undefined} className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-full border px-5 text-sm ${tier.id === plan.id ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}>{tier.label}</Link>)}</nav>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">{[
            ["Profit target", formatInr(limits.profitTarget), `${R.targetPercent}% of your starting balance`],
            ["Max drawdown", formatInr(limits.maximumLoss), "Trails your end-of-day high"],
            ["Daily loss limit", formatInr(limits.dailyLoss), `${R.dailyLossPercent}% of your starting balance`],
          ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] text-[var(--muted)]">{label}</p><p className="mt-3 text-2xl font-medium tracking-tight">{value}</p><p className="mt-2 text-[10px] leading-5 text-[var(--faint)]">{detail}</p></div>)}</div>
          <ul className="mt-7 space-y-3 text-xs leading-6 text-[var(--muted)]">{[`At least ${R.minimumDays} trading days. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit.`, `Intraday only: close every position by ${R.squareOff} IST.`, "Buy calls or puts, and sell only to close. No short options or spreads."].map((item) => <li key={item} className="flex items-start gap-3"><Check size={14} className="mt-1 shrink-0 text-[var(--primary)]" aria-hidden="true" />{item}</li>)}</ul>
          <Link href="/rules" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">See all rules <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <aside className="self-start rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-6 sm:p-8 lg:sticky lg:top-28"><div className="flex items-center justify-between gap-3"><p className="terminal-label">{plan.label} evaluation</p><span className="rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[10px] text-[var(--primary)]">{DEMO_CHECKOUT ? "Demo open" : "Launching soon"}</span></div><div className="mt-8 flex items-baseline gap-2"><p className="text-5xl font-medium tracking-[-.05em]">{formatInr(plan.fee)}</p><span className="text-sm text-[var(--muted)]">one-time</span></div><p className="mt-3 text-xs text-[var(--muted)]">GST included · no activation fee</p><dl className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)] text-xs"><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Max position</dt><dd>{plan.lots} {plan.lots === 1 ? "lot" : "lots"}</dd></div><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Profit split when funded</dt><dd>{R.contractorSharePercent}%</dd></div><div className="flex justify-between gap-3 py-4"><dt className="text-[var(--muted)]">Payout cap</dt><dd>{formatInr(plan.payoutCap)} per request</dd></div></dl><Link href={`/checkout/${plan.id}`} className="mt-7 flex min-h-12 items-center justify-center gap-3 rounded-full bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start evaluation <ArrowRight size={16} aria-hidden="true" /></Link><p className="mt-4 text-center text-[10px] leading-5 text-[var(--faint)]">{DEMO_CHECKOUT ? "Pay with your demo credit. You can change the size at checkout." : "Launching soon. Create your account now and we'll let you know when evaluations open."}</p></aside>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
