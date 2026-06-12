import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeMetrics } from "@/lib/metrics";
import { formatMoney, formatPercent, toISODate } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const { imported } = await searchParams;

  const account = await prisma.tradingAccount.findFirst({
    where: { userId: user.id },
    select: { id: true, accountName: true, startingBalance: true },
    orderBy: { createdAt: "asc" },
  });

  const days = account
    ? await prisma.dailyPnl.findMany({
        where: { accountId: account.id },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      })
    : [];

  const metrics =
    account && days.length > 0
      ? computeMetrics(
          days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) })),
          Number(account.startingBalance),
        )
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user.profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Public portal: <span className="font-mono text-slate-700">/p/{user.profile.slug}</span>
            {account && <span className="text-slate-400"> · {account.accountName}</span>}
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
        >
          Import trades
        </Link>
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
            <Card label="Win rate" value={formatPercent(metrics.winRate)} sub={`${metrics.winningDays}/${metrics.tradingDays} days`} />
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

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-800">Recent trading days</h2>
              <span className="text-xs text-slate-400">
                best {formatMoney(metrics.bestDay)} · worst {formatMoney(metrics.worstDay)}
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-1 pr-4 font-medium">Date</th>
                    <th className="py-1 pr-4 text-right font-medium">Net P&amp;L</th>
                    <th className="py-1 text-right font-medium">Equity</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.equityCurve]
                    .slice(-10)
                    .reverse()
                    .map((pt) => (
                      <tr key={pt.date} className="border-t border-slate-100">
                        <td className="py-1 pr-4 font-mono text-xs text-slate-600">{pt.date}</td>
                        <td
                          className={`py-1 pr-4 text-right tabular-nums ${
                            pt.cumulativePnl >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {formatMoney(pt.cumulativePnl, { cents: true })}
                        </td>
                        <td className="py-1 text-right tabular-nums text-slate-600">
                          {formatMoney(pt.equity, { cents: true })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Equity curve and daily P&amp;L charts arrive in the next milestone.
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-medium text-slate-800">No trading data yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Import a broker or prop-firm CSV to see your equity curve, win rate, drawdown, and risk
            analytics here.
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
          >
            Import your first CSV
          </Link>
        </div>
      )}
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
