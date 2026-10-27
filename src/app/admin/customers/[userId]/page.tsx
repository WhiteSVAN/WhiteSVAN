import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PnlBars } from "@/components/admin/charts";
import { KindBadge, LimitBar, Panel, StatTile, TableScroll, eventSummary, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { latestEvents, loadBook, pooledDays } from "@/lib/admin/book";
import { PROVIDER_LABELS, customerDetail, moneyReceived, orderStateLabel } from "@/lib/admin/customers";
import { DASH, duration, istDate, istDateTime, percent, ratio, rupees, signedRupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";
import { findAccountPlan } from "@/lib/prop-firm";
import { quotePayout, type PayoutBlock } from "@/lib/trading/payouts";

export const metadata: Metadata = { title: "Customer · Admin · WhiteSVAN" };

/** KYC, the funded trader agreement and bank verification aren't built yet, so no payout can be requested. */
const NO_CHECKS = { kycVerified: false, agreementSigned: false, bankVerified: false, onHold: false };
const BLOCKS: Record<PayoutBlock, string> = {
  NOT_FUNDED: "Not funded",
  ACCOUNT_CLOSED: "Account closed",
  OPEN_POSITIONS: "Open positions or orders",
  KYC: "KYC",
  AGREEMENT: "Agreement",
  BANK: "Bank account",
  ON_HOLD: "On hold",
  NO_PROFIT_ABOVE_BUFFER: "No profit above the buffer",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-sm [overflow-wrap:anywhere]">{children}</dd></div>;
}

/**
 * One customer: everything the firm holds on them but credentials. Their profile, sign-in and
 * referrals, every order with its billing details, their accounts as one book and each account,
 * payout figures on funded accounts, journal notes and their audit trail.
 */
export default async function AdminCustomerPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const admin = await requireAdmin();
  logger.info("admin.view", { adminId: admin.id, view: "customer", userId });
  const [customer, { traders }, events] = await Promise.all([customerDetail(userId), loadBook({ userId }), latestEvents({ take: 30, userId })]);
  if (!customer) notFound();
  const trader = traders[0];
  const who = encodeURIComponent(customer.email ?? "");
  const received = customer.orders.filter(moneyReceived).reduce((sum, order) => sum + order.amount, 0);
  const days = trader ? pooledDays(trader.accounts) : [];
  const cycles = trader ? trader.accounts.flatMap((account) => account.cycles.map((cycle) => ({ ...cycle, account }))).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).slice(0, 25) : [];
  const funded = trader ? trader.accounts.filter((account) => account.phase === "FUNDED") : [];
  const signIn = [customer.providers.includes("google") && "Google", customer.password && "Email and password", ...customer.providers.filter((provider) => provider !== "google")].filter(Boolean).join(", ") || "None";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Customers</Link>
        <h1 className="mt-3 text-3xl tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-4xl">{customer.name ?? customer.email}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
          {customer.name && <span>{customer.email}</span>}
          <span>Joined {istDate(customer.createdAt)}</span>
          {trader && <span>{trader.accounts.length} {trader.accounts.length === 1 ? "account" : "accounts"}: {trader.counts.active} active, {trader.counts.funded} funded, {trader.counts.passed} passed, {trader.counts.failed} failed</span>}
          {customer.isAdmin && <span className="text-[var(--primary)]">Admin</span>}
          {trader && trader.refusals > 0 && <span className="text-[var(--warning)]">{trader.refusals} refused {trader.refusals === 1 ? "order" : "orders"}</span>}
        </p>
      </div>

      <Panel title="Profile" note="As they signed up. Passwords and sign-in tokens are never shown.">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Email">{customer.email ?? DASH}</Field>
          <Field label="Name">{customer.name ?? DASH}</Field>
          <Field label="Joined">{istDateTime(customer.createdAt)} IST</Field>
          <Field label="Signs in with">{signIn}</Field>
          <Field label="Role">{customer.role === "TRADER" ? "Trader" : customer.role === "CLIENT" ? "Client" : "Not set"}{customer.isAdmin ? ", admin" : ""}</Field>
          <Field label="Referral code">{customer.referralCode ? <span className="font-mono text-xs">{customer.referralCode}</span> : DASH}</Field>
          <Field label="Referred by">{customer.referredBy ? <Link href={`/admin/customers/${customer.referredBy.id}`} className="hover:underline">{customer.referredBy.name ?? customer.referredBy.email}</Link> : DASH}</Field>
          <Field label="Referred">{customer._count.referrals ? `${customer._count.referrals} ${customer._count.referrals === 1 ? "person" : "people"}` : "Nobody yet"}</Field>
        </dl>
        {customer.referrals.length > 0 && (
          <p className="mt-5 text-sm text-[var(--muted)]">Referred: {customer.referrals.map((person, index) => <span key={person.id}>{index ? ", " : ""}<Link href={`/admin/customers/${person.id}`} className="text-[var(--foreground)] hover:underline">{person.name ?? person.email}</Link></span>)}</p>
        )}
      </Panel>

      <Panel title="Billing" note={`${customer.orders.length} ${customer.orders.length === 1 ? "order" : "orders"}; ${rupees(received)} received through live Razorpay. Test-mode, staff and free orders take no money.`} action={<Link href={`/admin/billing?q=${who}`} className="text-xs font-medium text-[var(--primary)]">In billing →</Link>}>
        {customer.orders.length === 0 ? <p className="text-sm text-[var(--muted)]">No orders.</p> : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Placed</th><th className={thNumber}>Amount</th><th className={th}>State</th><th className={th}>Payment</th><th className={th}>Billing contact</th><th className={th}>Terms accepted</th><th className={th}>Account</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {customer.orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(order.createdAt)}<p className="max-w-[8.5rem] truncate font-mono text-[10px]" title={order.id}>{order.id}</p></td>
                    <td className={tdNumber}>{rupees(order.amount)}<p className="text-[11px] text-[var(--muted)]">{findAccountPlan(order.planId)?.label ?? order.planId} account</p></td>
                    <td className={`${td} ${moneyReceived(order) ? "font-medium text-[var(--primary)]" : order.status === "FAILED" ? "text-[var(--danger)]" : ""}`}>{orderStateLabel(order.provider, order.status)}<p className="text-[11px] font-normal text-[var(--muted)]">{PROVIDER_LABELS[order.provider] ?? order.provider}</p>{order.paidAt && <p className="text-[11px] font-normal text-[var(--muted)]">{istDateTime(order.paidAt)}</p>}</td>
                    <td className={`${td} font-mono text-[11px] text-[var(--muted)]`}>{order.providerPaymentId ?? DASH}{order.providerOrderId?.startsWith("order_") && <p>{order.providerOrderId}</p>}</td>
                    <td className={`${td} max-w-[12rem] text-xs`}><p className="truncate">{order.billingName ?? DASH}</p><p className="truncate text-[var(--muted)]" title={order.billingEmail}>{order.billingEmail}</p>{order.billingPhone && <p className="text-[var(--muted)]">{order.billingPhone}</p>}{order.billingState && <p className="truncate text-[var(--muted)]" title={order.billingState}>GST state: {order.billingState}</p>}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(order.acceptedTermsAt)}</td>
                    <td className={td}>{order.account ? <Link href={`/admin/accounts/${order.account.id}`} className="font-mono text-xs hover:underline">{accountNumber(order.account.id, order.account.planId)}</Link> : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      {trader ? (
        <>
          <section aria-label="Trading across accounts" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <StatTile label="Net P&L" value={signedRupees(trader.netPnl)} valueClass={tone(trader.netPnl)} note="Balance over starting balance, every account" />
            <StatTile label="Return" value={percent(trader.daily.totalReturn, 2)} valueClass={tone(trader.daily.totalReturn)} note="On the summed starting balances" />
            <StatTile label="Sharpe" value={ratio(trader.daily.sharpe)} note={`${trader.daily.days} trading ${trader.daily.days === 1 ? "day" : "days"}, annualized`} />
            <StatTile label="Sortino" value={ratio(trader.daily.sortino)} note="Downside deviation only" />
            <StatTile label="Volatility" value={percent(trader.daily.volatility, 1)} note="Annualized" />
            <StatTile label="Max drawdown" value={percent(trader.daily.maxDrawdownShare, 2)} note="On the compounded daily returns" />
            <StatTile label="Win rate" value={percent(trader.trades.winRate, 0)} note={`${trader.trades.wins} of ${trader.trades.trades} round trips`} />
            <StatTile label="Profit factor" value={ratio(trader.trades.profitFactor)} />
            <StatTile label="Expectancy" value={signedRupees(trader.trades.expectancy)} valueClass={tone(trader.trades.expectancy)} note="Net per round trip" />
            <StatTile label="Payoff ratio" value={ratio(trader.trades.payoffRatio)} note="Average win over average loss" />
            <StatTile label="Average hold" value={duration(trader.trades.averageHoldingMs)} />
            <StatTile label="Charges" value={rupees(trader.trades.charges)} note={trader.trades.chargesShare === null ? undefined : `${percent(trader.trades.chargesShare, 0)} of gross profit`} />
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
                    const pnl = account.meters.balance - account.state.rules.startingBalance;
                    return (
                      <tr key={account.id} className="hover:bg-[var(--card-raised)]">
                        <td className={td}><Link href={`/admin/accounts/${account.id}`} className="font-mono text-xs hover:underline">{accountNumber(account.id, account.planId)}</Link><p className="text-[11px] text-[var(--muted)]">{account.planLabel} {account.phase === "FUNDED" ? "funded" : "evaluation"}</p></td>
                        <td className={td}><span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${badge.className}`}>{badge.text}</span>{account.waiting && <p className="mt-1 text-[11px] text-[var(--muted)]">Funded account waiting</p>}</td>
                        <td className={`${td} text-xs text-[var(--muted)]`}>{istDate(account.createdAt)}</td>
                        <td className={tdNumber}>{rupees(account.meters.balance)}</td>
                        <td className={`${tdNumber} ${tone(pnl)}`}>{signedRupees(pnl)}</td>
                        <td className={tdNumber}>{account.daily.days}</td>
                        <td className={tdNumber}>{ratio(account.daily.sharpe)}</td>
                        <td className={tdNumber}>{account.daily.days ? percent(account.daily.maxDrawdownShare, 2) : DASH}</td>
                        <td className={tdNumber}>{percent(account.trades.winRate, 0)}</td>
                        <td className={td}>{account.status === "ACTIVE" ? <LimitBar share={account.dailyLossShare} label="Daily loss used" /> : <span className="text-[var(--muted)]">{DASH}</span>}</td>
                        <td className={td}>{account.status === "ACTIVE" ? <LimitBar share={1 - account.roomShare} label="Drawdown room used" /> : <span className="text-[var(--muted)]">{DASH}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          {funded.length > 0 && (
            <Panel title="Payouts" note="What each funded account could pay out under the rules. No request can be made until KYC, the agreement and bank checks are built and done.">
              <TableScroll>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)]"><th className={th}>Account</th><th className={thNumber}>Profit</th><th className={thNumber}>Buffer</th><th className={thNumber}>Above the buffer</th><th className={thNumber}>Their share</th><th className={thNumber}>Payout now</th><th className={th}>Still needed</th></tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {funded.map((account) => {
                      const quote = quotePayout(account.state, NO_CHECKS);
                      return (
                        <tr key={account.id}>
                          <td className={td}><Link href={`/admin/accounts/${account.id}`} className="font-mono text-xs hover:underline">{accountNumber(account.id, account.planId)}</Link></td>
                          <td className={`${tdNumber} ${tone(quote.profit)}`}>{signedRupees(quote.profit, 2)}</td>
                          <td className={tdNumber}>{rupees(quote.buffer)}</td>
                          <td className={tdNumber}>{rupees(quote.withdrawableProfit, 2)}</td>
                          <td className={tdNumber}>{rupees(quote.traderShare, 2)}</td>
                          <td className={`${tdNumber} font-medium`}>{rupees(quote.payout, 2)}</td>
                          <td className={`${td} text-xs text-[var(--muted)]`}>{quote.blocks.map((block) => BLOCKS[block]).join(", ") || "Nothing"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            </Panel>
          )}

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
        </>
      ) : (
        <Panel title="Trading"><p className="text-sm text-[var(--muted)]">No demo or funded accounts yet.</p></Panel>
      )}

      <Panel title="Journal notes" note="What they wrote on their trading days, newest first.">
        {customer.notes.length === 0 ? <p className="text-sm text-[var(--muted)]">No notes.</p> : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {customer.notes.map((note) => (
              <li key={note.date.toISOString()} className="flex flex-wrap gap-3 py-2.5">
                <span className="w-28 shrink-0 text-xs text-[var(--muted)]">{istDate(note.date)}</span>
                <span className="min-w-[12rem] flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{note.text}</span>
              </li>
            ))}
          </ul>
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
