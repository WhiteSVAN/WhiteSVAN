import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PnlBars } from "@/components/admin/charts";
import { KindBadge, LimitBar, Panel, StatTile, TableScroll, eventSummary, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { latestEvents, loadBook, pooledDays } from "@/lib/admin/book";
import { duration, istDate, istDateTime, percent, ratio, rupees, signedRupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Trader · Admin · WhiteSVAN" };

/** One trader: their accounts as one book, each account's figures, their round trips and their audit trail. */
export default async function AdminTraderPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const admin = await requireAdmin();
  logger.info("admin.view", { adminId: admin.id, view: "trader", userId });
  const [{ traders }, events] = await Promise.all([loadBook({ userId }), latestEvents({ take: 30, userId })]);
  const trader = traders[0];
  if (!trader) notFound();
  const { daily, trades } = trader;
  const days = pooledDays(trader.accounts);
  const cycles = trader.accounts.flatMap((account) => account.cycles.map((cycle) => ({ ...cycle, account }))).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).slice(0, 25);
  const who = encodeURIComponent(trader.email ?? "");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/traders" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Traders</Link>
        <h1 className="mt-3 text-3xl tracking-[-0.03em] sm:text-4xl">{trader.name ?? trader.email}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
          {trader.name && <span>{trader.email}</span>}
          <span>Joined {istDate(trader.createdAt)}</span>
          <span>{trader.accounts.length} {trader.accounts.length === 1 ? "account" : "accounts"}: {trader.counts.active} active, {trader.counts.funded} funded, {trader.counts.passed} passed, {trader.counts.failed} failed</span>
          {trader.refusals > 0 && <span className="text-[var(--warning)]">{trader.refusals} refused {trader.refusals === 1 ? "order" : "orders"}</span>}
        </p>
      </div>

      <section aria-label="Performance across accounts" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatTile label="Net P&L" value={signedRupees(trader.netPnl)} valueClass={tone(trader.netPnl)} note="Balance over starting balance, every account" />
        <StatTile label="Return" value={percent(daily.totalReturn, 2)} valueClass={tone(daily.totalReturn)} note="On the summed starting balances" />
        <StatTile label="Sharpe" value={ratio(daily.sharpe)} note={`${daily.days} trading ${daily.days === 1 ? "day" : "days"}, annualized`} />
        <StatTile label="Sortino" value={ratio(daily.sortino)} note="Downside deviation only" />
        <StatTile label="Volatility" value={percent(daily.volatility, 1)} note="Annualized" />
        <StatTile label="Max drawdown" value={percent(daily.maxDrawdownShare, 2)} note="On the compounded daily returns" />
        <StatTile label="Win rate" value={percent(trades.winRate, 0)} note={`${trades.wins} of ${trades.trades} round trips`} />
        <StatTile label="Profit factor" value={ratio(trades.profitFactor)} />
        <StatTile label="Expectancy" value={signedRupees(trades.expectancy)} valueClass={tone(trades.expectancy)} note="Net per round trip" />
        <StatTile label="Payoff ratio" value={ratio(trades.payoffRatio)} note="Average win over average loss" />
        <StatTile label="Average hold" value={duration(trades.averageHoldingMs)} />
        <StatTile label="Charges" value={rupees(trades.charges)} note={trades.chargesShare === null ? undefined : `${percent(trades.chargesShare, 0)} of gross profit`} />
      </section>

      <Panel title="Daily P&L" note="Closed days, summed across accounts, after charges.">
        <PnlBars days={days} label="Daily P&L across accounts" />
      </Panel>

      <Panel title="Accounts">
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]"><th className={th}>Account</th><th className={th}>Status</th><th className={th}>Opened</th><th className={thNumber}>Balance</th><th className={thNumber}>Net P&amp;L</th><th className={thNumber}>Days</th><th className={thNumber}>Sharpe</th><th className={thNumber}>Max drawdown</th><th className={thNumber}>Win rate</th><th className={th}>Daily loss used</th><th className={th}>Drawdown room used</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {trader.accounts.map((account) => {
                const badge = STATUS_BADGE[account.status];
                return (
                  <tr key={account.id} className="hover:bg-[var(--card-raised)]">
                    <td className={td}><Link href={`/admin/accounts/${account.id}`} className="font-mono text-xs hover:underline">{accountNumber(account.id, account.planId)}</Link><p className="text-[11px] text-[var(--muted)]">{account.planLabel} {account.phase === "FUNDED" ? "funded" : "evaluation"}</p></td>
                    <td className={td}><span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${badge.className}`}>{badge.text}</span>{account.waiting && <p className="mt-1 text-[11px] text-[var(--muted)]">Funded account waiting</p>}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDate(account.createdAt)}</td>
                    <td className={tdNumber}>{rupees(account.meters.balance)}</td>
                    <td className={`${tdNumber} ${tone(account.meters.balance - account.state.rules.startingBalance)}`}>{signedRupees(account.meters.balance - account.state.rules.startingBalance)}</td>
                    <td className={tdNumber}>{account.daily.days}</td>
                    <td className={tdNumber}>{ratio(account.daily.sharpe)}</td>
                    <td className={tdNumber}>{percent(account.daily.maxDrawdownShare, 2)}</td>
                    <td className={tdNumber}>{percent(account.trades.winRate, 0)}</td>
                    <td className={td}>{account.status === "ACTIVE" ? <LimitBar share={account.dailyLossShare} label="Daily loss used" /> : <span className="text-[var(--muted)]">—</span>}</td>
                    <td className={td}>{account.status === "ACTIVE" ? <LimitBar share={1 - account.roomShare} label="Drawdown room used" /> : <span className="text-[var(--muted)]">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <Panel title="Latest round trips" note="Flat to flat in one contract, net of every charge." action={<Link href={`/admin/trades?q=${who}`} className="text-xs font-medium text-[var(--primary)]">Every fill →</Link>}>
        {cycles.length === 0 ? <p className="text-sm text-[var(--muted)]">No closed trades yet.</p> : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Contract</th><th className={th}>Account</th><th className={th}>Opened</th><th className={th}>Closed</th><th className={thNumber}>Units</th><th className={thNumber}>Held</th><th className={thNumber}>Charges</th><th className={thNumber}>Net</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cycles.map((cycle) => (
                  <tr key={`${cycle.account.id}-${cycle.token}-${cycle.openedAt}`}>
                    <td className={`${td} font-mono text-xs`}>{cycle.tradingSymbol}</td>
                    <td className={td}><Link href={`/admin/accounts/${cycle.account.id}`} className="font-mono text-xs hover:underline">{accountNumber(cycle.account.id, cycle.account.planId)}</Link></td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(cycle.openedAt)}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(cycle.closedAt)}</td>
                    <td className={tdNumber}>{cycle.quantity}</td>
                    <td className={tdNumber}>{duration(cycle.holdingMs)}</td>
                    <td className={tdNumber}>{rupees(cycle.charges, 2)}</td>
                    <td className={`${tdNumber} font-medium ${tone(cycle.net)}`}>{signedRupees(cycle.net, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="Audit trail" note="Orders, refusals, breaches and passes, newest first." action={<Link href={`/admin/audit?q=${who}`} className="text-xs font-medium text-[var(--primary)]">Full audit log →</Link>}>
        {events.length === 0 ? <p className="text-sm text-[var(--muted)]">Nothing recorded yet.</p> : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-32 shrink-0 text-xs text-[var(--muted)]">{istDateTime(event.at)}</span>
                <KindBadge kind={event.kind} />
                <span className="min-w-[12rem] flex-1 [overflow-wrap:anywhere]">{eventSummary(event.kind, event.detail)}</span>
                <Link href={`/admin/accounts/${event.accountId}`} className="font-mono text-[11px] text-[var(--muted)] hover:underline">{accountNumber(event.accountId, event.account.planId)}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
