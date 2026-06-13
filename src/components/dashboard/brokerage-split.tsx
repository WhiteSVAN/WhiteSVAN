import type { BrokerSummary } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";

/**
 * Brokerage-wise split — net P&L grouped by broker across all of a trader's
 * accounts, for the active date range. Complements the per-account view above
 * it; the `share` bar shows each broker's slice of total |net P&L|.
 */
export function BrokerageSplit({
  brokers,
  totalNet,
}: {
  brokers: BrokerSummary[];
  totalNet: number;
}) {
  // A split needs at least two groups to compare.
  if (brokers.length < 2) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-slate-800">By brokerage</h2>
        <span className="text-xs text-slate-500">
          Across all accounts · net{" "}
          <span className={totalNet >= 0 ? "text-emerald-600" : "text-red-600"}>
            {formatMoney(totalNet)}
          </span>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-1 pr-4 font-medium">Broker</th>
              <th className="py-1 pr-4 font-medium">Share</th>
              <th className="py-1 pr-4 text-right font-medium">Net P&amp;L</th>
              <th className="py-1 pr-4 text-right font-medium">Trades</th>
              <th className="py-1 pr-4 text-right font-medium">Days</th>
              <th className="py-1 text-right font-medium">Accts</th>
            </tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <tr key={b.broker} className="border-t border-slate-100">
                <td className="py-1.5 pr-4 font-medium text-slate-800">{b.broker}</td>
                <td className="py-1.5 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          b.netPnl >= 0 ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.round(b.share * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-slate-500">
                      {formatPercent(b.share)}
                    </span>
                  </div>
                </td>
                <td
                  className={`py-1.5 pr-4 text-right tabular-nums ${
                    b.netPnl >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatMoney(b.netPnl, { cents: true })}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">
                  {b.tradeCount}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">
                  {b.tradingDays}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{b.accounts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
