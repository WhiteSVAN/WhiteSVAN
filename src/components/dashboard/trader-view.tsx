import type { Metrics } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";
import { EquityCurveChart, type EquityPoint } from "@/components/charts/equity-curve";
import { DailyPnlChart, type DailyPoint } from "@/components/charts/daily-pnl";

/** Factual, non-advisory risk callouts for peer review. */
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

export function TraderView({
  metrics,
  equitySeries,
  dailySeries,
  currency = "USD",
}: {
  metrics: Metrics;
  equitySeries: EquityPoint[];
  dailySeries: DailyPoint[];
  /** ISO 4217 account currency (default USD). */
  currency?: string;
}) {
  const flags = riskFlags(metrics);
  const money = (v: number) => formatMoney(v, { currency });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card
          label="Net P&L"
          value={money(metrics.netPnl)}
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
          value={money(metrics.maxDrawdown)}
          tone="neg"
          sub={metrics.startingBalance > 0 ? `${metrics.maxDrawdownPct.toFixed(1)}%` : "Add starting capital for %"}
        />
        <Card
          label="Profit factor"
          value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : "—"}
          sub={`${metrics.losingDays} losing day${metrics.losingDays === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Equity curve">
          <EquityCurveChart data={equitySeries} currency={currency} />
        </ChartCard>
        <ChartCard title="Daily P&L">
          <DailyPnlChart data={dailySeries} currency={currency} />
        </ChartCard>
      </div>

      <div className="terminal-card p-4">
        <h2 className="text-sm font-medium text-zinc-800">Risk &amp; discipline</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Best day" value={money(metrics.bestDay)} tone="pos" />
          <Stat label="Worst day" value={money(metrics.worstDay)} tone="neg" />
          <Stat label="Avg green day" value={money(metrics.avgGreenDay)} />
          <Stat label="Avg red day" value={money(metrics.avgRedDay)} />
        </div>
        {flags.length > 0 && (
          <ul className="mt-4 space-y-1">
            {flags.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5">⚠</span>
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="terminal-card p-4">
      <h2 className="mb-2 text-sm font-medium text-zinc-800">{title}</h2>
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
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-zinc-900";
  return (
    <div className="terminal-card p-4">
      <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const valueColor =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-zinc-700";
  return (
    <div>
      <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
