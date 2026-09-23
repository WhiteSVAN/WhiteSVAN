import {
  PROOF_LEVELS,
  type TrustMetrics,
} from "@/lib/trust";
import { formatMoney, formatPercent } from "@/lib/format";
import { EquityCurveChart, type EquityPoint } from "@/components/charts/equity-curve";
import { DailyPnlChart, type DailyPoint } from "@/components/charts/daily-pnl";

export function ClientView({
  trust,
  equitySeries,
  dailySeries,
  hideAmounts,
  currency = "USD",
}: {
  trust: TrustMetrics;
  equitySeries: EquityPoint[];
  dailySeries: DailyPoint[];
  hideAmounts?: boolean;
  /** ISO 4217 account currency (default USD). */
  currency?: string;
}) {
  const m = trust.metrics;
  const proof = PROOF_LEVELS[trust.proofLevel];
  const capitalKnown = m.startingBalance > 0;
  const concentrated = (trust.bestDayShare ?? 0) > 0.5;
  const lopsided = (trust.badToGoodRatio ?? 0) > 1.3;
  const money = (v: number) => (hideAmounts ? "Private" : formatMoney(v, { currency }));

  return (
    <div className="space-y-8">
      {/* Snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Snapshot
          label="Net result"
          hint={hideAmounts ? "Amounts hidden" : "Realized result"}
          value={money(m.netPnl)}
          tone={hideAmounts ? undefined : m.netPnl >= 0 ? "pos" : "neg"}
        />
        <Snapshot
          label="Period return"
          hint="Profit relative to account size"
          value={m.returnPct != null ? formatPercent(m.returnPct, 1) : "-"}
          tone={(m.returnPct ?? 0) >= 0 ? "pos" : "neg"}
        />
        <Snapshot
          label="Max drawdown"
          hint="Largest peak-to-trough decline"
          value={capitalKnown ? `${m.maxDrawdownPct.toFixed(1)}%` : "—"}
        />
        <Snapshot label="Record length" hint="Trading days in this view" value={`${m.tradingDays} days`} small />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Equity path" subtitle="Account curve over the selected period">
          <EquityCurveChart data={equitySeries} hideAmounts={hideAmounts} currency={currency} />
        </ChartCard>
        <ChartCard title="Daily P&L" subtitle="Session-level realized performance">
          <DailyPnlChart data={dailySeries} hideAmounts={hideAmounts} currency={currency} />
        </ChartCard>
      </div>

      {/* Risk explained simply */}
      <div className="terminal-card p-5">
        <h2 className="text-sm font-medium text-white">Risk and structure</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Plain
            label="Max drawdown"
            value={
              hideAmounts
                ? capitalKnown ? `${m.maxDrawdownPct.toFixed(1)}%` : "Not available"
                : `${money(m.maxDrawdown)} (${m.maxDrawdownPct.toFixed(1)}%)`
            }
            note="The worst fall from a previous high."
            warn={trust.drawdownSeverity === "high" || trust.drawdownSeverity === "severe"}
          />
          <Plain label="Worst Day" value={money(m.worstDay)} note="The largest single-day loss." />
          <Plain
            label="Bounce-Back Time"
            value={trust.bounceBackDays != null ? `${trust.bounceBackDays} trading days` : "Not yet recovered"}
            note="How long it took to recover from the worst drop."
            warn={trust.bounceBackDays == null}
          />
          <Plain
            label="Big-Win Dependency"
            value={
              trust.bestDayShare != null
                ? `${Math.round(trust.bestDayShare * 100)}% from one day`
                : "-"
            }
            note="Whether profit relied on a single strong day."
            warn={concentrated}
          />
          <Plain
            label="Typical Good vs Bad Day"
            value={
              hideAmounts ? "Private" : `${money(m.avgGreenDay)} vs ${money(m.avgRedDay)}`
            }
            note={
              trust.badToGoodRatio != null
                ? `A typical bad day is ${trust.badToGoodRatio.toFixed(1)}x a typical good day.`
                : "Average size of winning and losing days."
            }
            warn={lopsided}
          />
          <Plain
            label="Profit Without Best Day"
            value={money(trust.profitWithoutBestDay)}
            note="What's left if the single best day is removed."
            warn={concentrated}
          />
        </div>
      </div>

      {/* Proof & privacy */}
      <div className="terminal-card p-5">
        <h2 className="text-sm font-medium text-white">Proof and privacy</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-400">Data source</p>
            <p className="mt-1 text-zinc-300">Broker-reported history</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-400">Record source</p>
            <p className="mt-1 text-zinc-300">{proof.label}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{proof.blurb}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-400">Redactions</p>
            <p className="mt-1 text-zinc-300">
              {hideAmounts ? "Amounts hidden" : "Full detail shown"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Public privacy settings change display only; metrics are not recalculated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Snapshot({
  label,
  hint,
  value,
  suffix,
  tone,
  badge,
  badgeClass,
  small,
}: {
  label: string;
  hint: string;
  value: string;
  suffix?: string;
  tone?: "pos" | "neg";
  badge?: string;
  badgeClass?: string;
  small?: boolean;
}) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-white";
  return (
    <div className="terminal-card p-4">
      <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      <p className={`mt-2 font-semibold ${small ? "text-lg" : "text-2xl"} ${color}`}>
        {value}
        {suffix && <span className="text-base font-normal text-zinc-400">{suffix}</span>}
      </p>
      {badge ? (
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeClass}`}>
          {badge}
        </span>
      ) : (
        <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>
      )}
    </div>
  );
}

function Plain({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: string;
  note: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        warn ? "border-amber-400/30 bg-amber-400/10" : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {warn && <span className="text-zinc-300">!</span>}
        <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      </div>
      <p className="mt-1 font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{note}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="terminal-card p-4">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="mb-2 text-xs text-zinc-400">{subtitle}</p>
      {children}
    </div>
  );
}
