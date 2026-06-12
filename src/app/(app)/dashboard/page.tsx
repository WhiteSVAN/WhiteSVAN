import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeMetrics, type Metrics } from "@/lib/metrics";
import { formatMoney, formatPercent, toISODate } from "@/lib/format";
import { DashboardControls } from "@/components/dashboard/controls";
import { EquityCurveChart } from "@/components/charts/equity-curve";
import { DailyPnlChart } from "@/components/charts/daily-pnl";

function rangeStartDate(range: string): Date | null {
  const now = new Date();
  if (range === "30d") return subDays(now, 30);
  if (range === "90d") return subDays(now, 90);
  if (range === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null; // "all"
}

/** Factual, non-advisory risk callouts derived from the metrics. */
function riskFlags(m: Metrics): string[] {
  const flags: string[] = [];
  if (m.maxDrawdownPct >= 10) {
    flags.push(`Drawdown reached ${m.maxDrawdownPct.toFixed(1)}% of peak equity.`);
  }
  const redRatio = m.tradingDays > 0 ? m.losingDays / m.tradingDays : 0;
  if (redRatio > 0.5) {
    flags.push(`More losing days than winning (${Math.round(redRatio * 100)}% red days).`);
  }
  const winShare = m.grossProfit > 0 ? m.bestDay / m.grossProfit : 0;
  if (winShare > 0.5) {
    flags.push(`A single day produced ${Math.round(winShare * 100)}% of gross profit.`);
  }
  return flags;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; account?: string; range?: string }>;
}) {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const { imported, account: accountParam, range: rangeParam } = await searchParams;
  const range = rangeParam ?? "all";

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
  const metrics =
    account && dailySeries.length > 0
      ? computeMetrics(dailySeries, Number(account.startingBalance))
      : null;
  const equitySeries = metrics?.equityCurve.map((p) => ({ date: p.date, equity: p.equity })) ?? [];
  const flags = metrics ? riskFlags(metrics) : [];

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
          {account && (
            <DashboardControls
              accounts={accounts.map((a) => ({ id: a.id, accountName: a.accountName }))}
              accountId={account.id}
              range={range}
            />
          )}
          <Link
            href="/upload"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
          >
            Import trades
          </Link>
        </div>
      </div>

      {imported && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Imported {imported} trades. Your metrics are updated below.
        </div>
      )}

      {metrics ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card
              label="Net P&L"
              value={formatMoney(metrics.netPnl)}
              tone={metrics.netPnl >= 0 ? "pos" : "neg"}
              sub={metrics.returnPct != null ? `${formatPercent(metrics.returnPct, 1)} return` : undefined}
            />
            <Card
              label="Win rate"
              value={formatPercent(metrics.winRate)}
              sub={`${metrics.winningDays}/${metrics.tradingDays} days`}
            />
            <Card
              label="Max drawdown"
              value={formatMoney(metrics.maxDrawdown)}
              tone="neg"
              sub={`${metrics.maxDrawdownPct.toFixed(1)}%`}
            />
            <Card
              label="Profit factor"
              value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : "—"}
              sub={`consistency ${metrics.consistencyScore}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Equity curve">
              <EquityCurveChart data={equitySeries} />
            </ChartCard>
            <ChartCard title="Daily P&L">
              <DailyPnlChart data={dailySeries} />
            </ChartCard>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-800">Risk &amp; discipline</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Best day" value={formatMoney(metrics.bestDay)} tone="pos" />
              <Stat label="Worst day" value={formatMoney(metrics.worstDay)} tone="neg" />
              <Stat label="Avg green day" value={formatMoney(metrics.avgGreenDay)} />
              <Stat label="Avg red day" value={formatMoney(metrics.avgRedDay)} />
            </div>
            {flags.length > 0 && (
              <ul className="mt-4 space-y-1">
                {flags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-amber-700">
                    <span className="mt-0.5">⚠</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-medium text-slate-800">
            {account ? "No trades in this range" : "No trading data yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {account
              ? "Try a wider date range, or import more trades."
              : "Import a broker or prop-firm CSV to see your equity curve, win rate, drawdown, and risk analytics here."}
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  const valueColor =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const valueColor =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "text-slate-700";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
