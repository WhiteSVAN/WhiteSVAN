import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { accountNumber } from "@/lib/checkout/billing";
import { settlement } from "@/lib/checkout/settlement";
import { findAccountPlan } from "@/lib/prop-firm";

export const metadata: Metadata = { title: "Order complete | WhiteSVAN", robots: { index: false } };

const dateText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The receipt for an order. Checkout goes straight to the platform; its welcome links here. */
export default async function CheckoutCompletePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: `/checkout/complete/${orderId}` })}`);
  const order = await prisma.checkoutOrder.findFirst({
    where: { id: orderId, userId },
    select: { id: true, planId: true, amount: true, provider: true, providerPaymentId: true, status: true, accountId: true, paidAt: true, billingEmail: true },
  });
  if (!order || order.status !== "PAID" || !order.accountId) notFound();
  const plan = findAccountPlan(order.planId);
  if (!plan) notFound();
  const settled = settlement(order);
  const rows: [string, string][] = [
    ["Demo account", accountNumber(order.accountId, plan.id)],
    ["Order", order.id],
    ["Amount", settled.amount],
    ["Payment", settled.payment],
    ["Date", order.paidAt ? `${dateText.format(order.paidAt)} IST` : "—"],
    ["Receipt sent to", order.billingEmail],
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16">
        <div className="text-center">
          <CircleCheck className="mx-auto h-12 w-12 text-[var(--primary)]" aria-hidden="true" />
          <p className="terminal-label mt-5">Order complete</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">Your {plan.label} demo account is ready.</h1>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/trade/${order.accountId}`} className="prop-button">Start trading <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/rules" className="prop-button-outline">Read the rules</Link>
          </div>
        </div>

        <dl className="terminal-card mt-12 divide-y divide-[var(--border)] px-6 text-sm">
          {rows.map(([term, value]) => <div key={term} className="flex flex-wrap justify-between gap-3 py-4"><dt className="text-[var(--muted)]">{term}</dt><dd className="break-all font-mono text-xs sm:text-sm">{value}</dd></div>)}
        </dl>
      </main>
      <SiteFooter />
    </div>
  );
}
