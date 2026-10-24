import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/app/waitlist-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { MAX_ACTIVE_ACCOUNTS, planAmount } from "@/lib/checkout/billing";
import { checkoutModeFor } from "@/lib/checkout/config";
import { demoCreditLeft } from "@/lib/checkout/demo";
import { activeAccountCount } from "@/lib/checkout/orders";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, planLimits, PROGRAMME_RULES as R } from "@/lib/prop-firm";
import { checkout } from "../actions";
import { CheckoutForm } from "./checkout-form";

type Props = { params: Promise<{ plan: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = findEvaluationPlan((await params).plan);
  return { title: plan ? `Checkout: ${plan.label} evaluation | WhiteSVAN` : "Checkout | WhiteSVAN", robots: { index: false } };
}

/**
 * Checkout for one evaluation, in the order a prop-firm buyer expects: details, agreements, payment.
 * Until payments go live, staff make test purchases and everyone else pays with demo credit.
 */
export default async function CheckoutPage({ params }: Props) {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) notFound();
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/signup?plan=${plan.id}`);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, demoCreditSpent: true } });
  if (!user?.email) redirect(`/login?${new URLSearchParams({ next: `/checkout/${plan.id}` })}`);
  const mode = checkoutModeFor(user.email);
  const active = await activeAccountCount(userId);
  const limits = planLimits(plan);
  const total = formatInr(plan.fee);

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14">
        <Link href={`/evaluations/${plan.id}`} className="inline-flex min-h-10 items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--primary)]"><ArrowLeft size={14} aria-hidden="true" /> {plan.label} evaluation</Link>
        <h1 className="mt-6 text-4xl font-medium tracking-[-.05em] sm:text-5xl">Checkout</h1>
        <nav aria-label="Change account size" className="mt-5 flex flex-wrap gap-2">
          {EVALUATION_PLANS.map((tier) => (
            <Link key={tier.id} href={`/checkout/${tier.id}`} aria-current={tier.id === plan.id ? "page" : undefined} className={`inline-flex min-h-10 min-w-16 items-center justify-center rounded-full border px-4 text-sm ${tier.id === plan.id ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"}`}>{tier.label}</Link>
          ))}
        </nav>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8" aria-label="Checkout details">
            {active >= MAX_ACTIVE_ACCOUNTS ? (
              <div>
                <h2 className="text-xl font-medium tracking-tight">You have {active} active evaluations</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Traders can hold up to {MAX_ACTIVE_ACCOUNTS} active evaluation accounts at a time. Pass or close one to buy another.</p>
                <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Go to my accounts</Link>
              </div>
            ) : mode !== "closed" ? (
              <CheckoutForm action={checkout.bind(null, plan.id)} email={user.email} defaultName={user.name ?? ""} total={total} mode={mode} price={planAmount(plan)} creditLeft={demoCreditLeft(user.demoCreditSpent)} />
            ) : (
              <div>
                <p className="terminal-label text-[var(--primary)]">Launching soon</p>
                <h2 className="mt-3 text-2xl font-medium tracking-tight">Checkout opens at launch.</h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">You&apos;re signed in and your order is ready. We aren&apos;t taking payments yet: join the launch list and we&apos;ll email you the day checkout opens, so you can start your {plan.label} evaluation.</p>
                <div className="mt-6"><WaitlistForm defaultEmail={user.email} /></div>
                <Link href="/academy?tab=evaluations#academy-content" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]"><BookOpen size={15} aria-hidden="true" /> Practise the rules meanwhile</Link>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-[var(--border-strong)] bg-[var(--card-deep)] p-6 sm:p-8 lg:sticky lg:top-28" aria-labelledby="summary-title">
            <p id="summary-title" className="terminal-label">Order summary</p>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <p className="text-lg font-medium">{plan.label} evaluation</p>
              <p className="text-3xl font-medium tracking-[-.04em]">{total}</p>
            </div>
            <p className="mt-1 text-right text-xs text-[var(--muted)]">{mode === "demo" ? "Paid with demo credit · nobody is charged" : "One-time · GST included"}</p>
            <dl className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)] text-xs">
              {summary.map(([term, value]) => <div key={term} className="flex justify-between gap-4 py-3"><dt className="text-[var(--muted)]">{term}</dt><dd className={term === "Activation fee" ? "text-[var(--primary)]" : ""}>{value}</dd></div>)}
            </dl>
            <ul className="mt-6 space-y-2.5 text-xs leading-5 text-[var(--muted)]">
              {["NIFTY, BANK NIFTY and SENSEX futures and options", "Intraday: positions close at 15:20 IST", `When you pass, your best day is at most ${R.consistencyPercent}% of your profit`].map((item) => (
                <li key={item} className="flex gap-2.5"><Check size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />{item}</li>
              ))}
            </ul>
            <p className="mt-6 flex gap-2.5 text-[11px] leading-5 text-[var(--faint)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Evaluation and funded accounts are simulated. No deposit, no real money traded. Payouts on funded accounts are real.</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
