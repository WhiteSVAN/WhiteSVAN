import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeTrustMetrics } from "@/lib/trust";
import { breakdownByBrokerAndAccount } from "@/lib/metrics";
import { accountProofLevel } from "@/lib/proof";
import { toISODate } from "@/lib/format";
import { BrokerageBreakdown } from "@/components/dashboard/brokerage-breakdown";
import { DashboardControls } from "@/components/dashboard/controls";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { BalanceEditor } from "@/components/dashboard/balance-editor";
import { PortalShare } from "@/components/dashboard/portal-share";
import { ClientView } from "@/components/dashboard/client-view";
import { TraderView } from "@/components/dashboard/trader-view";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { ProfileStatusCard } from "@/components/dashboard/profile-status";

function rangeStartDate(range: string): Date | null {
  const now = new Date();
  if (range === "30d") return subDays(now, 30);
  if (range === "90d") return subDays(now, 90);
  if (range === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null; // "all"
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; account?: string; range?: string; view?: string }>;
}) {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const { imported, account: accountParam, range: rangeParam, view: viewParam } = await searchParams;
  const range = rangeParam ?? "all";
  const view = viewParam === "trader" ? "trader" : "client";

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: user.id },
    select: { id: true, accountName: true, startingBalance: true, broker: true },
    orderBy: { createdAt: "asc" },
  });
  const account = accounts.find((a) => a.id === accountParam) ?? accounts[0];

  const start = rangeStartDate(range);

  // Brokerage-wise breakdown — net P&L by broker → account across every account,
  // for the same date range. Only worth a query (and the section) with 2+ accounts.
  let breakdown: ReturnType<typeof breakdownByBrokerAndAccount> | null = null;
  if (accounts.length > 1) {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const allDays = await prisma.dailyPnl.findMany({
      where: { account: { userId: user.id }, ...(start ? { tradeDate: { gte: start } } : {}) },
      select: { accountId: true, tradeDate: true, netPnl: true, grossPnl: true, fees: true, tradeCount: true },
    });
    breakdown = breakdownByBrokerAndAccount(
      allDays.map((d) => {
        const acct = accountById.get(d.accountId);
        return {
          broker: acct?.broker?.trim() || acct?.accountName || "Unknown",
          accountId: d.accountId,
          accountName: acct?.accountName ?? "Unknown",
          date: toISODate(d.tradeDate),
          netPnl: Number(d.netPnl),
          grossPnl: Number(d.grossPnl),
          fees: Number(d.fees),
          tradeCount: d.tradeCount,
        };
      }),
    );
  }
  const days = account
    ? await prisma.dailyPnl.findMany({
        where: { accountId: account.id, ...(start ? { tradeDate: { gte: start } } : {}) },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      })
    : [];

  const dailySeries = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const proofLevel = account ? await accountProofLevel(account.id, dailySeries.length > 0) : 1;
  const trust =
    account && dailySeries.length > 0
      ? computeTrustMetrics(dailySeries, Number(account.startingBalance), proofLevel)
      : null;
  const equitySeries =
    trust?.metrics.equityCurve.map((p) => ({ date: p.date, equity: p.equity })) ?? [];

  // Profile-wide data coverage (all accounts, ignoring the range filter) for the status card.
  const coverage = await prisma.dailyPnl.aggregate({
    where: { account: { userId: user.id } },
    _min: { tradeDate: true },
    _max: { tradeDate: true },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user.profile.displayName}
          </h1>
          <PortalShare slug={user.profile.slug} isPublic={user.profile.isPublic} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle view={view} />
          {account && <DashboardControls accounts={accounts.map((a) => ({ id: a.id, accountName: a.accountName }))} accountId={account.id} range={range} />}
          <Link
            href="/upload"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
          >
            Import trades
          </Link>
        </div>
      </div>

      <ProfileStatusCard
        isPublic={user.profile.isPublic}
        proofLevel={proofLevel}
        cadence={user.profile.updateCadence}
        lastPublishedAt={user.profile.lastPublishedAt}
        transparencyScore={trust?.scores.transparency ?? null}
        coverageStart={coverage._min.tradeDate ? toISODate(coverage._min.tradeDate) : null}
        coverageEnd={coverage._max.tradeDate ? toISODate(coverage._max.tradeDate) : null}
      />

      {account && (
        <BalanceEditor accountId={account.id} startingBalance={Number(account.startingBalance)} />
      )}

      {imported && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Imported {imported} trades. Your metrics are updated below.
        </div>
      )}

      {breakdown && (
        <BrokerageBreakdown brokers={breakdown.brokers} totalNet={breakdown.totalNet} />
      )}

      {trust ? (
        view === "trader" ? (
          <TraderView metrics={trust.metrics} equitySeries={equitySeries} dailySeries={dailySeries} />
        ) : (
          <ClientView trust={trust} equitySeries={equitySeries} dailySeries={dailySeries} />
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-medium text-slate-800">
            {account ? "No trades in this range" : "No trading data yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {account
              ? "Try a wider date range, or import more trades."
              : "Import a broker or prop-firm CSV to see a plain-English trust report and the full analytics here."}
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
          >
            {account ? "Import more" : "Import your first CSV"}
          </Link>
        </div>
      )}

      {trust && <CalendarHeatmap data={dailySeries} />}
    </div>
  );
}
