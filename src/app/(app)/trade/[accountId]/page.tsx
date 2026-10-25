import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { AccountMeters } from "@/components/markets/account-panel";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { ConnectZerodha } from "@/components/markets/connect-zerodha";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { findAccount } from "@/lib/accounts/store";
import { requireUser } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findAccountPlan } from "@/lib/prop-firm";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
import { PRICES_OFFLINE, sharedKiteSession } from "@/lib/zerodha/connection";

export const metadata: Metadata = { title: "Trading platform · WhiteSVAN", robots: { index: false } };

/**
 * One evaluation account's trading platform, on the firm's shared Kite login. While the login is
 * down, traders see their account and wait; owners get the Kite login card.
 */
export default async function TradePage({ params, searchParams }: { params: Promise<{ accountId: string }>; searchParams: Promise<{ feed?: string }> }) {
  const user = await requireUser();
  const { accountId } = await params;
  const account = await findAccount(user.id, accountId);
  if (!account) notFound();
  const plan = findAccountPlan(account.planId);
  const planLabel = plan?.label ?? account.planId;
  const config = kiteConfig();
  const owner = isKiteOwner(config, user.email);
  const session = config ? await sharedKiteSession(config.sessionSecret) : null;
  const status = STATUS_BADGE[account.status];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> My accounts</Link>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{planLabel} {account.demo ? "demo evaluation" : "evaluation"}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          <span className="font-mono">{accountNumber(account.id, account.planId)}</span>
          {account.demo && <span className="rounded-full border border-[var(--warning)]/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--warning)]">Demo</span>}
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
        </p>
      </div>

      <ZerodhaNotice code={(await searchParams).feed} />

      {session ? (
        <ZerodhaCharts account={{ id: account.id, desk: account.desk, planLabel, demo: account.demo }} canConnect={owner} />
      ) : owner ? (
        <ConnectZerodha next={`/trade/${account.id}`} />
      ) : (
        <section className="grid items-start gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="terminal-card p-6 sm:p-8">
            <p className="terminal-label">Trading platform</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight">Live prices are offline</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{PRICES_OFFLINE} Your account, balance and rules stay as they are.</p>
            <Link href="/academy?tab=evaluations#academy-content" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm hover:border-[var(--primary)] hover:text-[var(--primary)]"><BookOpen className="h-4 w-4" aria-hidden="true" /> Practise the rules meanwhile</Link>
          </div>
          <aside className="terminal-card space-y-5 p-5" aria-label="Account">
            <AccountMeters desk={account.desk} demo={account.demo} />
          </aside>
        </section>
      )}

      <p className="max-w-3xl text-xs leading-6 text-[var(--muted)]">Evaluation and funded accounts are simulated: fills follow the live order book with slippage and Indian F&amp;O charges, and no order reaches an exchange. Charts by TradingView Lightweight Charts.</p>
    </div>
  );
}
