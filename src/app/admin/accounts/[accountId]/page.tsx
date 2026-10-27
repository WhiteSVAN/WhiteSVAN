import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BalanceLine, PnlBars } from "@/components/admin/charts";
import { KindBadge, Panel, StatTile, TableScroll, eventSummary, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { AccountMeters } from "@/components/markets/account-panel";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { balanceHistory, latestEvents, latestFills, loadBook } from "@/lib/admin/book";
import { DASH, duration, istDate, istDateTime, percent, ratio, rupees, signedRupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";
import { maxLossFloor } from "@/lib/trading/rules";

export const metadata: Metadata = { title: "Account · Admin · WhiteSVAN" };

const FILLS_SHOWN = 200;

/** One account in full: risk now, every quant figure, its balance against the floor, round trips, fills and audit trail. */
export default async function AdminAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const admin = await requireAdmin();
  logger.info("admin.view", { adminId: admin.id, view: "account", accountId });
  const [{ traders, accounts }, fills, events] = await Promise.all([
    loadBook({ accountId }),
    latestFills({ take: FILLS_SHOWN, accountId }),
    latestEvents({ take: 500, accountId }),
  ]);
  const account = accounts[0];
  if (!account) notFound();
  const trader = traders[0];
  const { daily, trades, state } = account;
  const badge = STATUS_BADGE[account.status];
  const history = balanceHistory(state);
  const start = state.rules.startingBalance;
  const points = [{ date: "start", closing: start, floor: maxLossFloor(state.rules, start) }, ...history.map((day) => ({ date: day.date, closing: day.closing, floor: day.floor }))];
  const breach = state.breach;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/admin/customers/${account.userId}`} className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {trader?.name ?? trader?.email ?? "Trader"}</Link>
        <h1 className="mt-3 text-3xl tracking-[-0.03em] sm:text-4xl">{account.planLabel} {account.phase === "FUNDED" ? "funded account" : "evaluation"}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
          <span className="font-mono text-xs">{accountNumber(account.id, account.planId)}</span>
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${badge.className}`}>{badge.text}</span>
          <span>Opened {istDate(account.createdAt)}</span>
          <span>Rules {state.rules.version}</span>
          <span>Last saved {istDateTime(state.clock)} IST</span>
          {account.fromAccountId && <Link href={`/admin/accounts/${account.fromAccountId}`} className="hover:underline">From evaluation {accountNumber(account.fromAccountId, account.planId)}</Link>}
          {account.waiting && <span className="text-[var(--warning)]">Passed; funded account waiting for a free place</span>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Panel title="Risk now" note="The trader's own meters, from the account as last saved.">
          <div className="space-y-4"><AccountMeters desk={{ version: 1, state, instruments: [], fills: [], notes: [] }} passNote={null} /></div>
        </Panel>
        <section aria-label="Performance" className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
          <StatTile label="Net P&L, closed days" value={signedRupees(daily.netPnl)} valueClass={tone(daily.netPnl)} note={`${percent(daily.totalReturn, 2)} of the starting balance`} />
          <StatTile label="Sharpe" value={ratio(daily.sharpe)} note={`${daily.days} trading ${daily.days === 1 ? "day" : "days"}`} />
          <StatTile label="Sortino" value={ratio(daily.sortino)} />
          <StatTile label="Volatility" value={percent(daily.volatility, 1)} note="Annualized" />
          <StatTile label="Max drawdown" value={percent(daily.maxDrawdownShare, 2)} note={rupees(daily.maxDrawdown)} />
          <StatTile label="Calmar" value={ratio(daily.calmar)} />
          <StatTile label="Winning days" value={percent(daily.winningDayRate, 0)} note={`${daily.winningDays} up, ${daily.losingDays} down`} />
          <StatTile label="Best-day share" value={percent(daily.bestDayShare, 0)} note={`The rule allows ${state.rules.consistencyPercent}%`} />
          <StatTile label="Win rate" value={percent(trades.winRate, 0)} note={`${trades.wins} of ${trades.trades} round trips`} />
          <StatTile label="Profit factor" value={ratio(trades.profitFactor)} note={`Payoff ${ratio(trades.payoffRatio)}`} />
          <StatTile label="Expectancy" value={signedRupees(trades.expectancy)} valueClass={tone(trades.expectancy)} note={`Average hold ${duration(trades.averageHoldingMs)}`} />
          <StatTile label="Charges" value={rupees(trades.charges)} note={trades.chargesShare === null ? undefined : `${percent(trades.chargesShare, 0)} of gross profit`} />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Closing balance and floor" note="The max drawdown floor trails the highest close until it reaches the starting balance.">
          <BalanceLine points={points} label="Closing balance and drawdown floor" />
        </Panel>
        <Panel title="Daily P&L" note="Closed days, after charges.">
          <PnlBars days={history} label="Daily P&L" />
        </Panel>
      </div>

      {breach && (
        <Panel title="Breach report" note={`Rule version ${breach.ruleVersion}`}>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-[var(--muted)]">Rule</dt><dd className="mt-1 font-medium text-[var(--danger)]">{breach.rules.map((rule) => (rule === "DAILY_LOSS" ? "Daily loss limit" : "Max drawdown")).join(" and ")}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">When</dt><dd className="mt-1">{istDateTime(breach.at)} IST</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Equity</dt><dd className="tabular-figures mt-1">{rupees(breach.equity, 2)}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Limits</dt><dd className="tabular-figures mt-1">Day opened {rupees(breach.dayOpeningBalance)}, daily limit {rupees(breach.dailyLossLimit)}, floor {rupees(breach.maxLossFloor)}</dd></div>
            <div className="col-span-2 sm:col-span-4"><dt className="text-xs text-[var(--muted)]">Trigger</dt><dd className="mt-1">{breach.trigger.kind === "fill" ? `Fill: ${breach.trigger.side === "BUY" ? "bought" : "sold"} ${breach.trigger.quantity} ${breach.trigger.tradingSymbol} at ${rupees(breach.trigger.price, 2)}` : `Price: ${breach.trigger.tradingSymbol} at ${rupees(breach.trigger.lastPrice, 2)}`}{breach.positions.length ? `; open then: ${breach.positions.map((position) => `${position.quantity} ${position.tradingSymbol}`).join(", ")}` : ""}</dd></div>
          </dl>
        </Panel>
      )}

      <Panel title="Days" note="Rebuilt from the starting balance and each closed day's net P&L.">
        {history.length === 0 ? <p className="text-sm text-[var(--muted)]">No closed trading days yet.</p> : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Date</th><th className={thNumber}>Opening</th><th className={thNumber}>Net P&amp;L</th><th className={thNumber}>Return</th><th className={thNumber}>Closing</th><th className={thNumber}>Floor after</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[...history].reverse().map((day) => (
                  <tr key={day.date}>
                    <td className={td}>{istDate(new Date(`${day.date}T06:00:00Z`))}</td>
                    <td className={tdNumber}>{rupees(day.opening, 2)}</td>
                    <td className={`${tdNumber} ${tone(day.net)}`}>{signedRupees(day.net, 2)}</td>
                    <td className={`${tdNumber} ${tone(day.return)}`}>{percent(day.return, 2)}</td>
                    <td className={tdNumber}>{rupees(day.closing, 2)}</td>
                    <td className={tdNumber}>{rupees(day.floor, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Round trips" note={`Flat to flat in one contract, net of every charge.${account.openTrades ? ` ${account.openTrades} still open.` : ""}`}>
        {account.cycles.length === 0 ? <p className="text-sm text-[var(--muted)]">No closed trades yet.</p> : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Contract</th><th className={th}>Side</th><th className={th}>Opened</th><th className={th}>Closed</th><th className={thNumber}>Units</th><th className={thNumber}>Fills</th><th className={thNumber}>Held</th><th className={thNumber}>Gross</th><th className={thNumber}>Charges</th><th className={thNumber}>Net</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {account.cycles.map((cycle) => (
                  <tr key={`${cycle.token}-${cycle.openedAt}`}>
                    <td className={`${td} font-mono text-xs`}>{cycle.tradingSymbol}</td>
                    <td className={`${td} text-xs`}>{cycle.direction === "LONG" ? "Long" : "Short"}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(cycle.openedAt)}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(cycle.closedAt)}</td>
                    <td className={tdNumber}>{cycle.quantity}</td>
                    <td className={tdNumber}>{cycle.fills}</td>
                    <td className={tdNumber}>{duration(cycle.holdingMs)}</td>
                    <td className={`${tdNumber} ${tone(cycle.realised)}`}>{signedRupees(cycle.realised, 2)}</td>
                    <td className={tdNumber}>{rupees(cycle.charges, 2)}</td>
                    <td className={`${tdNumber} font-medium ${tone(cycle.net)}`}>{signedRupees(cycle.net, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Fills" note={`Every fill, newest first${fills.length === FILLS_SHOWN ? ` (the latest ${FILLS_SHOWN} here)` : ""}.`} action={<Link href={`/admin/trades?account=${account.id}`} className="text-xs font-medium text-[var(--primary)]">Filter and export →</Link>}>
        {fills.length === 0 ? <p className="text-sm text-[var(--muted)]">No fills yet.</p> : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Time</th><th className={th}>Contract</th><th className={th}>Side</th><th className={thNumber}>Units</th><th className={thNumber}>Price</th><th className={th}>Why</th><th className={thNumber}>Realised</th><th className={thNumber}>Charges</th><th className={thNumber}>Balance after</th><th className={th}>Order</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {fills.map((fill) => (
                  <tr key={fill.id}>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(fill.at)}</td>
                    <td className={`${td} font-mono text-xs`}>{fill.tradingSymbol}</td>
                    <td className={`${td} text-xs font-medium ${fill.side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{fill.side === "BUY" ? "Buy" : "Sell"}</td>
                    <td className={tdNumber}>{fill.quantity}</td>
                    <td className={tdNumber}>{rupees(fill.price, 2)}</td>
                    <td className={`${td} text-xs`}>{fill.reason === "ORDER" ? "Order" : fill.reason === "SQUARE_OFF" ? "Square-off" : "Breach"}</td>
                    <td className={`${tdNumber} ${tone(fill.realised)}`}>{fill.realised ? signedRupees(fill.realised, 2) : DASH}</td>
                    <td className={tdNumber}>{rupees(fill.chargesTotal, 2)}</td>
                    <td className={tdNumber}>{rupees(fill.balanceAfter, 2)}</td>
                    <td className={`${td} font-mono text-[11px] text-[var(--muted)]`}>{fill.orderId ?? DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Audit trail" note="Orders placed, changed, cancelled, rejected or refused, breaches and passes.">
        {events.length === 0 ? <p className="text-sm text-[var(--muted)]">Nothing recorded yet.</p> : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-32 shrink-0 text-xs text-[var(--muted)]">{istDateTime(event.at)}</span>
                <KindBadge kind={event.kind} />
                <span className="min-w-[12rem] flex-1 [overflow-wrap:anywhere]">{eventSummary(event.kind, event.detail)}</span>
                {event.orderId && <span className="font-mono text-[11px] text-[var(--muted)]">{event.orderId}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
