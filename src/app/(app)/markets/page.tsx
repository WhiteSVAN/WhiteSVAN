import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConnectZerodha, PricesOffline } from "@/components/markets/connect-zerodha";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { listAccounts } from "@/lib/accounts/store";
import { requireUser } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
import { sharedKiteSession } from "@/lib/zerodha/connection";

export const metadata: Metadata = { title: "Zerodha charts · WhiteSVAN", robots: { index: false } };

const sessionEnd = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Charts for every signed-in user on the firm's shared Zerodha login, which the KITE_OWNER_EMAILS
 * connect. With an active evaluation account (`?account=` picks one), it is also the trading
 * platform; everyone else gets Buy and Sell pointing to evaluations. A 404 while Zerodha isn't set up.
 */
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ zerodha?: string; account?: string }> }) {
  const user = await requireUser();
  const config = kiteConfig();
  if (!config) notFound();
  const owner = isKiteOwner(config, user.email);
  const [session, accounts, params] = await Promise.all([sharedKiteSession(config.sessionSecret), listAccounts(user.id), searchParams]);
  const active = accounts.filter((account) => account.status === "ACTIVE");
  const chosen = active.find((account) => account.id === params.account) ?? active[0] ?? null;
  const planLabel = (planId: string) => findEvaluationPlan(planId)?.label ?? planId;
  const home = chosen ? `/markets?account=${chosen.id}` : "/markets";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="terminal-label">Markets</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Zerodha charts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">NIFTY, BANK NIFTY and SENSEX: the index, futures and options, with live prices and market depth from Zerodha. Trade futures and options from the chart on your evaluation account.</p>
        </div>
        {owner && session && (
          <form action="/api/zerodha/logout" method="post" className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            <span>Shared with every signed-in user. Connected as <span className="font-mono text-[var(--foreground)]">{session.kiteUserId}</span> until {sessionEnd.format(session.expiresAt)} IST</span>
            <button type="submit" className="min-h-9 rounded-md border border-[var(--border-strong)] px-3 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Disconnect</button>
          </form>
        )}
      </div>

      <ZerodhaNotice code={params.zerodha} />
      {session ? (
        <ZerodhaCharts
          key={chosen?.id ?? "charts"}
          canConnect={owner}
          home={home}
          account={chosen ? { id: chosen.id, desk: chosen.desk, planLabel: planLabel(chosen.planId) } : undefined}
          accounts={active.map((account) => ({ id: account.id, label: `${planLabel(account.planId)} · ${accountNumber(account.id, account.planId)}`, href: `/markets?account=${account.id}` }))}
        />
      ) : owner ? (
        <ConnectZerodha next={home} />
      ) : (
        <PricesOffline />
      )}

      <p className="max-w-3xl text-xs leading-6 text-[var(--muted)]">Evaluation and funded accounts are simulated: fills follow the live order book with slippage and Indian F&amp;O charges, and no order reaches an exchange. Prices and depth come from the firm&apos;s Zerodha account through Kite Connect. Charts by TradingView Lightweight Charts.</p>
    </div>
  );
}
