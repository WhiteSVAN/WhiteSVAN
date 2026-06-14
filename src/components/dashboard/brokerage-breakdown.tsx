import type { BrokerBreakdown } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";

/**
 * Two-level P&L breakdown — brokers with each account nested beneath. Shared by
 * the trader dashboard and the public portal; on the portal, `hideAmounts`
 * redacts dollar figures (shares, trade counts, and days are still shown).
 *
 * Self-hides unless there are 2+ accounts to compare.
 */
export function BrokerageBreakdown({
  brokers,
  totalNet,
  hideAmounts = false,
  title = "By brokerage",
}: {
  brokers: BrokerBreakdown[];
  totalNet: number;
  hideAmounts?: boolean;
  title?: string;
}) {
  const accountCount = brokers.reduce((n, b) => n + b.accounts.length, 0);
  if (accountCount < 2) return null;

  const money = (v: number) => (hideAmounts ? "Private" : formatMoney(v, { cents: true }));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-slate-800">{title}</h2>
        <span className="text-xs text-slate-500">
          Across all accounts
          {!hideAmounts && (
            <>
              {" "}
              · net{" "}
              <span className={totalNet >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatMoney(totalNet)}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-1 pr-4 font-medium">Broker / account</th>
              <th className="py-1 pr-4 font-medium">Share</th>
              <th className="py-1 pr-4 text-right font-medium">Net P&amp;L</th>
              <th className="py-1 pr-4 text-right font-medium">Trades</th>
              <th className="py-1 text-right font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <BrokerGroup key={b.broker} broker={b} money={money} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShareBar({ share, positive }: { share: number; positive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${positive ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-slate-500">{formatPercent(share)}</span>
    </div>
  );
}

function BrokerGroup({
  broker: b,
  money,
}: {
  broker: BrokerBreakdown;
  money: (v: number) => string;
}) {
  // A single-account broker doesn't need a separate subtotal row.
  const single = b.accounts.length === 1;

  return (
    <>
      <tr className="border-t border-slate-200 bg-slate-50/60">
        <td className="py-1.5 pr-4 font-semibold text-slate-800">
          {b.broker}
          {!single && <span className="ml-1 font-normal text-slate-400">({b.accounts.length})</span>}
        </td>
        <td className="py-1.5 pr-4">
          <ShareBar share={b.share} positive={b.netPnl >= 0} />
        </td>
        <td
          className={`py-1.5 pr-4 text-right font-semibold tabular-nums ${
            b.netPnl >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {money(b.netPnl)}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-slate-600">{b.tradeCount}</td>
        <td className="py-1.5 text-right tabular-nums text-slate-600">{b.tradingDays}</td>
      </tr>

      {!single &&
        b.accounts.map((a) => (
          <tr key={a.accountId} className="border-t border-slate-100">
            <td className="py-1.5 pr-4 pl-4 text-slate-600">{a.accountName}</td>
            <td className="py-1.5 pr-4">
              <ShareBar share={a.share} positive={a.netPnl >= 0} />
            </td>
            <td
              className={`py-1.5 pr-4 text-right tabular-nums ${
                a.netPnl >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {money(a.netPnl)}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-slate-500">{a.tradeCount}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-500">{a.tradingDays}</td>
          </tr>
        ))}
    </>
  );
}
