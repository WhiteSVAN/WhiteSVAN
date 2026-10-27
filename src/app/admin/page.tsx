import type { Metadata } from "next";
import Link from "next/link";
import { KindBadge, LimitBar, Panel, StatTile, TableScroll, eventSummary, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { tradingNow } from "@/lib/accounts/clock";
import { RANKING_MIN_DAYS, dayActivity, latestEvents, loadBook } from "@/lib/admin/book";
import { customerTotals } from "@/lib/admin/customers";
import { istDateTime, percent, ratio, rupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";
import { toIst } from "@/lib/trading/time";

export const metadata: Metadata = { title: "Overview · Admin · WhiteSVAN" };

const WEEK_MS = 7 * 86_400_000;

/** The firm at a glance: accounts, today's activity, what needs a look, the best risk-adjusted traders and the latest audit events. */
export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  logger.info("admin.view", { adminId: admin.id, view: "overview" });
  const now = tradingNow();
  const today = toIst(now).date;
  const [{ traders, accounts }, activity, week, recent, totals] = await Promise.all([
    loadBook(),
    dayActivity(today),
    latestEvents({ take: 500, kinds: ["BREACH", "ORDER_REFUSED"], since: new Date(now - WEEK_MS) }),
    latestEvents({ take: 15 }),
    customerTotals(),
  ]);
  const evaluations = accounts.filter((account) => account.phase === "EVALUATION");
  const passed = evaluations.filter((account) => account.status === "PASSED").length;
  const failed = evaluations.filter((account) => account.status === "FAILED").length;
  const near = accounts.filter((account) => account.nearLimit);
  const waiting = accounts.filter((account) => account.waiting);
  const todayAlerts = week.filter((event) => toIst(event.at.getTime()).date === today);
  const ranked = traders.filter((trader) => trader.daily.days >= RANKING_MIN_DAYS && trader.daily.sharpe !== null).sort((a, b) => (b.daily.sharpe ?? 0) - (a.daily.sharpe ?? 0)).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Overview</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Every demo and funded account, as last saved. {istDateTime(now)} IST.</p>
      </div>

      <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Customers" value={String(totals.customers)} note="Everyone signed up" />
        <StatTile label="Traders" value={String(traders.length)} note="With at least one account" />
        <StatTile label="Active evaluations" value={String(evaluations.filter((account) => account.status === "ACTIVE").length)} />
        <StatTile label="Funded accounts" value={String(accounts.filter((account) => account.phase === "FUNDED" && account.status === "ACTIVE").length)} note={waiting.length ? `${waiting.length} waiting to activate` : undefined} />
        <StatTile label="Pass rate" value={percent(passed + failed ? passed / (passed + failed) : null, 0)} note={`${passed} passed, ${failed} failed`} />
        <StatTile label="Fills today" value={String(activity.fills)} note={`${activity.traders} ${activity.traders === 1 ? "trader" : "traders"} trading`} />
        <StatTile label="Charges today" value={rupees(activity.charges)} note="Brokerage, taxes and fees on today's fills" />
        <StatTile label="Breaches, 7 days" value={String(week.filter((event) => event.kind === "BREACH").length)} valueClass={week.some((event) => event.kind === "BREACH") ? "text-[var(--danger)]" : ""} />
        <StatTile label="Refused orders, 7 days" value={String(week.filter((event) => event.kind === "ORDER_REFUSED").length)} note="Blocked by the trading policy" />
        <StatTile label="Received" value={rupees(totals.received)} valueClass={totals.received ? "text-[var(--primary)]" : ""} note={`${totals.receivedOrders} live Razorpay ${totals.receivedOrders === 1 ? "payment" : "payments"}, all time`} />
      </section>

      <Panel title="Needs a look" note="Active accounts within a quarter of a limit, passes waiting for a funded place, and today's breaches and refusals.">
        {near.length === 0 && waiting.length === 0 && todayAlerts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing right now.</p>
        ) : (
          <div className="space-y-6">
            {near.length > 0 && (
              <TableScroll>
                <table className="w-full text-sm">
                  <caption className="mb-2 text-left text-xs font-medium text-[var(--muted)]">Near a limit</caption>
                  <thead><tr className="border-b border-[var(--border)]"><th className={th}>Trader</th><th className={th}>Account</th><th className={th}>Daily loss used</th><th className={th}>Drawdown room used</th><th className={thNumber}>Equity</th><th className={th}>As of</th></tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {near.map((account) => {
                      const trader = traders.find((item) => item.id === account.userId);
                      return (
                        <tr key={account.id}>
                          <td className={td}><Link href={`/admin/customers/${account.userId}`} className="font-medium hover:underline">{trader?.name ?? trader?.email}</Link></td>
                          <td className={td}><Link href={`/admin/accounts/${account.id}`} className="font-mono text-xs hover:underline">{accountNumber(account.id, account.planId)}</Link></td>
                          <td className={td}><LimitBar share={account.dailyLossShare} label="Daily loss used" /></td>
                          <td className={td}><LimitBar share={1 - account.roomShare} label="Drawdown room used" /></td>
                          <td className={tdNumber}>{rupees(account.meters.equity)}</td>
                          <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(account.state.clock)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
            {waiting.length > 0 && (
              <p className="text-sm">{waiting.length} {waiting.length === 1 ? "pass is" : "passes are"} waiting for a funded place: {waiting.map((account, index) => <span key={account.id}>{index ? ", " : ""}<Link href={`/admin/accounts/${account.id}`} className="font-mono text-xs hover:underline">{accountNumber(account.id, account.planId)}</Link></span>)}.</p>
            )}
            {todayAlerts.length > 0 && (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {todayAlerts.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <KindBadge kind={event.kind} />
                    <Link href={`/admin/customers/${event.user.id}`} className="font-medium hover:underline">{event.user.name ?? event.user.email}</Link>
                    <span className="min-w-[12rem] flex-1 [overflow-wrap:anywhere] text-[var(--muted)]">{eventSummary(event.kind, event.detail)}</span>
                    <span className="text-xs text-[var(--muted)]">{istDateTime(event.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Best risk-adjusted traders" note={`By Sharpe ratio across their accounts, with at least ${RANKING_MIN_DAYS} trading days.`} action={<Link href="/admin/traders?sort=sharpe" className="text-xs font-medium text-[var(--primary)]">All traders →</Link>}>
          {ranked.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No trader has {RANKING_MIN_DAYS} trading days yet.</p>
          ) : (
            <TableScroll>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]"><th className={th}>Trader</th><th className={thNumber}>Sharpe</th><th className={thNumber}>Sortino</th><th className={thNumber}>Return</th><th className={thNumber}>Max drawdown</th><th className={thNumber}>Days</th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {ranked.map((trader) => (
                    <tr key={trader.id}>
                      <td className={td}><Link href={`/admin/customers/${trader.id}`} className="font-medium hover:underline">{trader.name ?? trader.email}</Link></td>
                      <td className={`${tdNumber} font-semibold`}>{ratio(trader.daily.sharpe)}</td>
                      <td className={tdNumber}>{ratio(trader.daily.sortino)}</td>
                      <td className={`${tdNumber} ${tone(trader.daily.totalReturn)}`}>{percent(trader.daily.totalReturn, 2)}</td>
                      <td className={tdNumber}>{percent(trader.daily.maxDrawdownShare, 2)}</td>
                      <td className={tdNumber}>{trader.daily.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <Panel title="Latest activity" action={<Link href="/admin/audit" className="text-xs font-medium text-[var(--primary)]">Audit log →</Link>}>
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {recent.map((event) => (
                <li key={event.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindBadge kind={event.kind} />
                    <Link href={`/admin/accounts/${event.accountId}`} className="text-xs font-medium hover:underline">{event.user.name ?? event.user.email}</Link>
                    <span className="ml-auto text-[11px] text-[var(--muted)]">{istDateTime(event.at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{eventSummary(event.kind, event.detail)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
