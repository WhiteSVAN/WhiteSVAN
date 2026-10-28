import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConnectZerodha, PricesOffline } from "@/components/markets/connect-zerodha";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { tradingNow } from "@/lib/accounts/clock";
import { loadAccounts } from "@/lib/accounts/store";
import { requireUser } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findAccountPlan } from "@/lib/prop-firm";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
import { sharedKiteSession } from "@/lib/zerodha/connection";

export const metadata: Metadata = { title: "Trade · WhiteSVAN", robots: { index: false } };

const sessionEnd = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Charts for every signed-in user on the firm's shared Zerodha login, which the KITE_OWNER_EMAILS
 * connect. With an active demo or funded account (`?account=` picks one), it is also the trading
 * platform; everyone else gets Buy and Sell pointing to evaluations. A 404 while Zerodha isn't set up.
 */
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ feed?: string; account?: string }> }) {
  const user = await requireUser();
  const config = kiteConfig();
  if (!config) notFound();
  const owner = isKiteOwner(config, user.email);
  const [session, accounts, params] = await Promise.all([sharedKiteSession(config.sessionSecret), loadAccounts(user.id, tradingNow()), searchParams]);
  const active = accounts.filter((account) => account.status === "ACTIVE");
  const chosen = active.find((account) => account.id === params.account) ?? active[0] ?? null;
  const planLabel = (planId: string) => findAccountPlan(planId)?.label ?? planId;
  const kind = (account: { phase: string }) => (account.phase === "FUNDED" ? "funded" : "demo");
  const home = chosen ? `/markets?account=${chosen.id}` : "/markets";

  return (
    <div className="space-y-3">
      {!session && (
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Trade</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">NIFTY, BANK NIFTY and SENSEX options on live prices. Chart the index or any option, and buy or sell from the panel beside the chart.</p>
        </div>
      )}

      <ZerodhaNotice code={params.feed} />
      {session ? (
        <ZerodhaCharts
          key={chosen?.id ?? "charts"}
          header={
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <h1 className="text-lg">Trade</h1>
              {owner && (
                <form action="/api/zerodha/logout" method="post" className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                  <span>Live prices are on for everyone until {sessionEnd.format(session.expiresAt)} IST</span>
                  <button type="submit" className="min-h-8 rounded-md border border-[var(--border-strong)] px-2.5 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Disconnect</button>
                </form>
              )}
            </div>
          }
          canConnect={owner}
          home={home}
          account={chosen ? { id: chosen.id, desk: chosen.desk } : undefined}
          accounts={active.map((account) => ({ id: account.id, label: `${planLabel(account.planId)} ${kind(account)} · ${accountNumber(account.id, account.planId)}`, href: `/markets?account=${account.id}` }))}
        />
      ) : owner ? (
        <ConnectZerodha next={home} />
      ) : (
        <PricesOffline />
      )}
    </div>
  );
}
