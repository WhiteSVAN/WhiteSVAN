import type { Metadata } from "next";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { tradingNow } from "@/lib/accounts/clock";
import { loadAccounts } from "@/lib/accounts/store";
import { requireUser } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findAccountPlan } from "@/lib/prop-firm";
// Kite, commented out while Global Datafeeds is the price feed (30 Oct 2026):
// import { notFound } from "next/navigation";
// import { ConnectZerodha, PricesOffline } from "@/components/markets/connect-zerodha";
// import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
// import { sharedKiteSession } from "@/lib/zerodha/connection";

export const metadata: Metadata = { title: "Trade · WhiteSVAN", robots: { index: false } };

/**
 * Charts for every signed-in user on Global Datafeeds prices (the trial carries SENSEX options, so
 * the screen opens on SENSEX). With an active demo or funded account (`?account=` picks one), it is
 * also the trading platform; everyone else gets Buy and Sell pointing to evaluations.
 */
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ feed?: string; account?: string }> }) {
  const user = await requireUser();
  const [accounts, params] = await Promise.all([loadAccounts(user.id, tradingNow()), searchParams]);
  const active = accounts.filter((account) => account.status === "ACTIVE");
  const chosen = active.find((account) => account.id === params.account) ?? active[0] ?? null;
  const planLabel = (planId: string) => findAccountPlan(planId)?.label ?? planId;
  const kind = (account: { phase: string }) => (account.phase === "FUNDED" ? "funded" : "demo");
  const home = chosen ? `/markets?account=${chosen.id}` : "/markets";

  return (
    <div className="space-y-3">
      <ZerodhaNotice code={params.feed} />
      <ZerodhaCharts
        key={chosen?.id ?? "charts"}
        startOn="SENSEX"
        header={
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-lg">Trade</h1>
          </div>
        }
        canConnect={false}
        home={home}
        account={chosen ? { id: chosen.id, desk: chosen.desk } : undefined}
        accounts={active.map((account) => ({ id: account.id, label: `${planLabel(account.planId)} ${kind(account)} · ${accountNumber(account.id, account.planId)}`, href: `/markets?account=${account.id}` }))}
      />
    </div>
  );
}
