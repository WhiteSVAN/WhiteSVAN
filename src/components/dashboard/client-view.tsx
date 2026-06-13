import {
  PROOF_LEVELS,
  type DrawdownSeverity,
  type TrustMetrics,
} from "@/lib/trust";
import { formatMoney, formatPercent } from "@/lib/format";
import { EquityCurveChart, type EquityPoint } from "@/components/charts/equity-curve";
import { DailyPnlChart, type DailyPoint } from "@/components/charts/daily-pnl";

const SEVERITY: Record<DrawdownSeverity, { label: string; text: string; bg: string }> = {
  controlled: { label: "Controlled", text: "text-emerald-700", bg: "bg-emerald-50" },
  elevated: { label: "Elevated", text: "text-amber-700", bg: "bg-amber-50" },
  high: { label: "High risk", text: "text-orange-700", bg: "bg-orange-50" },
  severe: { label: "Severe", text: "text-red-700", bg: "bg-red-50" },
};

export function ClientView({
  trust,
  equitySeries,
  dailySeries,
}: {
  trust: TrustMetrics;
  equitySeries: EquityPoint[];
  dailySeries: DailyPoint[];
}) {
  const m = trust.metrics;
  const sev = SEVERITY[trust.drawdownSeverity];
  const proof = PROOF_LEVELS[trust.proofLevel];
  const concentrated = (trust.bestDayShare ?? 0) > 0.5;
  const lopsided = (trust.badToGoodRatio ?? 0) > 1.3;

  return (
    <div className="space-y-8">
      {/* Snapshot */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Snapshot
          label="Total Result"
          hint="Money made or lost"
          value={formatMoney(m.netPnl)}
          tone={m.netPnl >= 0 ? "pos" : "neg"}
        />
        <Snapshot
          label="Growth Rate"
          hint="Profit vs starting size"
          value={m.returnPct != null ? formatPercent(m.returnPct, 1) : "—"}
          tone={(m.returnPct ?? 0) >= 0 ? "pos" : "neg"}
        />
        <Snapshot
          label="Biggest Drop"
          hint="Worst fall from a high"
          value={`${m.maxDrawdownPct.toFixed(1)}%`}
          badge={sev.label}
          badgeClass={`${sev.bg} ${sev.text}`}
        />
        <Snapshot
          label="TrustSVAN Score"
          hint="Transparency, not advice"
          value={`${trust.scores.transparency}`}
          suffix="/100"
        />
        <Snapshot label="Proof Level" hint={`Level ${trust.proofLevel} of 5`} value={proof.label} small />
      </div>

      {/* Verdict */}
      <div className={`rounded-xl border border-slate-200 p-5 ${sev.bg}`}>
        <h2 className={`text-lg font-semibold ${sev.text}`}>{trust.verdict.headline}</h2>
        <p className="mt-1 text-sm text-slate-700">{trust.verdict.body}</p>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Growth Path" subtitle="The account's journey over time">
          <EquityCurveChart data={equitySeries} />
        </ChartCard>
        <ChartCard title="Daily Results" subtitle="Green days and red days">
          <DailyPnlChart data={dailySeries} />
        </ChartCard>
      </div>

      {/* Risk explained simply */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-800">Risk, explained simply</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Plain
            label="Biggest Drop"
            value={`${formatMoney(m.maxDrawdown)} (${m.maxDrawdownPct.toFixed(1)}%)`}
            note="The worst fall from a previous high."
            warn={trust.drawdownSeverity === "high" || trust.drawdownSeverity === "severe"}
          />
          <Plain
            label="Worst Day"
            value={formatMoney(m.worstDay)}
            note="The largest single-day loss."
          />
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
                : "—"
            }
            note="Whether profit leaned on a single lucky day."
            warn={concentrated}
          />
          <Plain
            label="Typical Good vs Bad Day"
            value={`${formatMoney(m.avgGreenDay)} vs ${formatMoney(m.avgRedDay)}`}
            note={
              trust.badToGoodRatio != null
                ? `A typical bad day is ${trust.badToGoodRatio.toFixed(1)}x a typical good day.`
                : "Average size of winning and losing days."
            }
            warn={lopsided}
          />
          <Plain
            label="Profit Without Best Day"
            value={formatMoney(trust.profitWithoutBestDay)}
            note="What's left if the single best day is removed."
            warn={concentrated}
          />
        </div>
      </div>

      {/* Trust scores */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-800">TrustSVAN Transparency Score</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ScoreBar label="Profit" value={trust.scores.profit} />
          <ScoreBar label="Risk Control" value={trust.scores.riskControl} />
          <ScoreBar label="Consistency" value={trust.scores.consistency} />
          <ScoreBar label="Discipline" value={trust.scores.discipline} />
          <ScoreBar label="Proof" value={trust.scores.proof} />
        </div>
        <p className="mt-4 text-xs text-slate-400">
          The TrustSVAN Transparency Score is not an investment recommendation. It measures data
          quality, risk visibility, and reporting discipline.
        </p>
      </div>

      {/* Proof & privacy */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-800">Proof &amp; privacy</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Data source</p>
            <p className="mt-1 text-slate-700">CSV import</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Proof level</p>
            <p className="mt-1 text-slate-700">
              Level {trust.proofLevel}: {proof.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{proof.blurb}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Redactions</p>
            <p className="mt-1 text-slate-700">Full detail shown</p>
            <p className="mt-0.5 text-xs text-slate-400">Redaction controls are coming soon.</p>
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
  const color = tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 font-semibold ${small ? "text-lg" : "text-2xl"} ${color}`}>
        {value}
        {suffix && <span className="text-base font-normal text-slate-400">{suffix}</span>}
      </p>
      {badge ? (
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeClass}`}>
          {badge}
        </span>
      ) : (
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
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
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-200 bg-amber-50" : "border-slate-100"}`}>
      <div className="flex items-center gap-1.5">
        {warn && <span className="text-amber-600">⚠</span>}
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-1 font-semibold tabular-nums text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value);
  const color = pct >= 67 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-400">{pct}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium text-slate-800">{title}</h3>
      <p className="mb-2 text-xs text-slate-400">{subtitle}</p>
      {children}
    </div>
  );
}
