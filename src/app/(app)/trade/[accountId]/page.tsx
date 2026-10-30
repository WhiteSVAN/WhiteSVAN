import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, X } from "lucide-react";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { findAccount } from "@/lib/accounts/store";
import { requireUser } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { settlement } from "@/lib/checkout/settlement";
import { prisma } from "@/lib/db";
import { findAccountPlan } from "@/lib/prop-firm";
// Kite, commented out while Global Datafeeds is the price feed (30 Oct 2026):
// import { AccountMeters } from "@/components/markets/account-panel";
// import { ConnectZerodha } from "@/components/markets/connect-zerodha";
// import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
// import { PRICES_OFFLINE, sharedKiteSession } from "@/lib/zerodha/connection";

export const metadata: Metadata = { title: "Trading platform · WhiteSVAN", robots: { index: false } };

/**
 * One account's trading platform (a demo account, or a funded one), on Global Datafeeds prices
 * (the trial carries SENSEX options, so it opens on SENSEX).
 * Checkout lands here with `?opened=<order>`, which shows the welcome.
 */
export default async function TradePage({ params, searchParams }: { params: Promise<{ accountId: string }>; searchParams: Promise<{ feed?: string; opened?: string }> }) {
  const user = await requireUser();
  const { accountId } = await params;
  const { feed, opened } = await searchParams;
  const account = await findAccount(user.id, accountId);
  if (!account) notFound();
  const order = opened
    ? await prisma.checkoutOrder.findFirst({ where: { id: opened, userId: user.id, accountId: account.id, status: "PAID" }, select: { id: true, provider: true, amount: true, providerPaymentId: true } })
    : null;
  const plan = findAccountPlan(account.planId);
  const planLabel = plan?.label ?? account.planId;
  // Kite, commented out while Global Datafeeds is the price feed (30 Oct 2026):
  // const config = kiteConfig();
  // const owner = isKiteOwner(config, user.email);
  // const session = config ? await sharedKiteSession(config.sessionSecret) : null;
  const status = STATUS_BADGE[account.status];
  // The account's title: the start of the platform's account bar, or a row of its own while prices are offline.
  const heading = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <Link href="/dashboard" aria-label="My accounts" title="My accounts" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card-raised)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link>
      <h1 className="text-lg">{planLabel} {account.phase === "FUNDED" ? "funded account" : "demo account"}</h1>
      <span className="font-mono text-[11px] text-[var(--muted)]">{accountNumber(account.id, account.planId)}</span>
      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {order && (
        <section role="status" className="terminal-card flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex gap-3">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold">Your {planLabel} demo account is open.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{settlement(order).summary} Trade it whenever you like, inside the rules.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href={`/checkout/complete/${order.id}`} className="font-medium hover:text-[var(--primary)]">Receipt</Link>
            <Link href="/rules" className="font-medium hover:text-[var(--primary)]">The rules</Link>
            <Link href={`/trade/${account.id}`} aria-label="Dismiss" className="text-[var(--muted)] hover:text-[var(--foreground)]"><X className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>
      )}

      <ZerodhaNotice code={feed} />

      <ZerodhaCharts header={heading} account={{ id: account.id, desk: account.desk }} canConnect={false} startOn="SENSEX" />
      {/* Kite, commented out while Global Datafeeds is the price feed (30 Oct 2026): the Kite login card for owners and "Live prices are offline" (with the account's meters) for traders. */}
    </div>
  );
}
