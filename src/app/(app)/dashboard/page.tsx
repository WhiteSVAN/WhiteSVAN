import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeTrustMetrics } from "@/lib/trust";
import { toISODate } from "@/lib/format";
import { DashboardControls } from "@/components/dashboard/controls";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { BalanceEditor } from "@/components/dashboard/balance-editor";
import { ClientView } from "@/components/dashboard/client-view";
import { TraderView } from "@/components/dashboard/trader-view";

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
    select: { id: true, accountName: true, startingBalance: true },
    orderBy: { createdAt: "asc" },
  });
  const account = accounts.find((a) => a.id === accountParam) ?? accounts[0];

  const start = rangeStartDate(range);
  const days = account
    ? await prisma.dailyPnl.findMany({
        where: { accountId: account.id, ...(start ? { tradeDate: { gte: start } } : {}) },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      })
    : [];

  const dailySeries = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const trust =
    account && dailySeries.length > 0
      ? computeTrustMetrics(dailySeries, Number(account.startingBalance), 2)
      : null;
  const equitySeries =
    trust?.metrics.equityCurve.map((p) => ({ date: p.date, equity: p.equity })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user.profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Public portal: <span className="font-mono text-slate-700">/p/{user.profile.slug}</span>
          </p>
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

      {account && (
        <BalanceEditor accountId={account.id} startingBalance={Number(account.startingBalance)} />
      )}

      {imported && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Imported {imported} trades. Your metrics are updated below.
        </div>
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
    </div>
  );
}
