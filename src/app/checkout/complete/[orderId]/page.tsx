import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { accountNumber } from "@/lib/checkout/billing";
import { demoCreditLeft } from "@/lib/checkout/demo";
import { findEvaluationPlan, formatInr, planLimits, PROGRAMME_RULES as R } from "@/lib/prop-firm";
import { formatPaise } from "@/lib/trading/money";

export const metadata: Metadata = { title: "Order complete | WhiteSVAN", robots: { index: false } };

const dateText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The confirmation after checkout, with the way into the platform. */
export default async function CheckoutCompletePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: `/checkout/complete/${orderId}` })}`);
  const order = await prisma.checkoutOrder.findFirst({
    where: { id: orderId, userId },
    select: { id: true, planId: true, amount: true, provider: true, status: true, accountId: true, paidAt: true, billingEmail: true },
  });
  if (!order || order.status !== "PAID" || !order.accountId) notFound();
  const plan = findEvaluationPlan(order.planId);
  if (!plan) notFound();
  const limits = planLimits(plan);
  const demo = order.provider === "demo";
  const creditLeft = demo ? demoCreditLeft((await prisma.user.findUnique({ where: { id: userId }, select: { demoCreditSpent: true } }))?.demoCreditSpent ?? 0) : null;
  const payment = order.provider === "test" ? "Test purchase, not charged" : demo ? "Demo credit, nobody charged" : order.provider;
  const rows: [string, string][] = [
    ["Account", accountNumber(order.accountId, plan.id)],
    ["Order", order.id],
    ["Amount", demo ? `${formatPaise(order.amount, 0)} in demo credit` : `${formatPaise(order.amount, 0)} · GST included`],
    ["Payment", payment],
    ...(creditLeft !== null ? [["Demo credit left", formatPaise(creditLeft, 2)] as [string, string]] : []),
    ["Date", order.paidAt ? `${dateText.format(order.paidAt)} IST` : "—"],
    ["Receipt sent to", order.billingEmail],
  ];
  const steps: [string, string][] = [
    ["Trade the evaluation", "NIFTY, BANK NIFTY and SENSEX futures and options, intraday, on the platform."],
    ["Pass", `Hit the ${R.targetPercent}% target in ${R.minimumDays} or more trading days, inside both loss limits.`],
    demo
      ? ["Demo only", "A demo evaluation shows how it works. Passing it doesn't lead to a funded account or a payout."]
      : ["Get funded", `KYC and your funded trader agreement, then an ${R.contractorSharePercent}% profit split.`],
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16">
        <div className="text-center">
          <CircleCheck className="mx-auto h-12 w-12 text-[var(--primary)]" aria-hidden="true" />
          <p className="terminal-label mt-5 text-[var(--primary)]">Order complete</p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-.05em] sm:text-5xl">Your {plan.label} {demo ? "demo evaluation" : "evaluation"} is ready.</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--muted)]">Open the trading platform and start whenever you like. Hit {formatInr(limits.profitTarget)} in at least {R.minimumDays} trading days without touching the {formatInr(limits.dailyLoss)} daily loss limit or the {formatInr(limits.maximumLoss)} max drawdown.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/trade/${order.accountId}`} className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start trading <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/dashboard" className="inline-flex min-h-12 items-center rounded-full border border-[var(--border-strong)] px-6 text-sm hover:bg-[var(--card-raised)]">Go to my accounts</Link>
          </div>
        </div>

        <dl className="mt-12 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 text-sm">
          {rows.map(([term, value]) => <div key={term} className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-[var(--muted)]">{term}</dt><dd className="break-all font-mono text-xs sm:text-sm">{value}</dd></div>)}
        </dl>

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-5">
              <span className="font-mono text-xs text-[var(--primary)]">0{index + 1}</span>
              <h2 className="mt-3 text-sm font-medium">{title}</h2>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{body}</p>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
