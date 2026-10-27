import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pager, Panel, StatTile, TableScroll, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { PROVIDER_LABELS, moneyReceived, orderStateLabel, ordersPage } from "@/lib/admin/customers";
import { ORDER_PROVIDERS, PAGE_SIZE, filterQuery, orderFilters, type Params } from "@/lib/admin/filters";
import { DASH, istDateTime, rupees } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber, INDIAN_STATES } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";
import { findAccountPlan } from "@/lib/prop-firm";

export const metadata: Metadata = { title: "Billing · Admin · WhiteSVAN" };

const STATUS_OPTIONS = [["PAID", "Paid or opened"], ["PENDING", "Awaiting payment"], ["FAILED", "Failed"], ["REFUNDED", "Refunded"]] as const;

/** Every checkout order: who, what size, how it was paid (or not), the billing contact and GST state, with totals and a CSV export. */
export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  const filters = orderFilters(await searchParams, INDIAN_STATES);
  logger.info("admin.view", { adminId: admin.id, view: "billing", filters });
  const { rows, count, totals } = await ordersPage(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Billing</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Every checkout order. Only a captured live Razorpay payment is money received; Razorpay test mode, staff test purchases and free starts take none. The GST state is the place of supply the customer chose. Times are IST.</p>
      </div>

      <FilterBar
        reset="/admin/billing"
        fields={[
          { name: "from", label: "From", type: "date", value: filters.from },
          { name: "to", label: "To", type: "date", value: filters.to },
          { name: "q", label: "Search", value: filters.q, placeholder: "Customer, phone, order or payment id", width: "w-64" },
          { name: "provider", label: "Paid with", value: filters.provider, options: ORDER_PROVIDERS.map((provider) => [provider, PROVIDER_LABELS[provider]] as const) },
          { name: "status", label: "State", value: filters.status, options: STATUS_OPTIONS },
          { name: "state", label: "GST state", value: filters.state, options: INDIAN_STATES.map((state) => [state, state] as const) },
        ]}
      >
        <a href={`/admin/billing/export${filterQuery({ ...filters, page: 1 })}`} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm hover:bg-[var(--card-raised)]"><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</a>
      </FilterBar>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Received" value={rupees(totals.received.amount)} valueClass={totals.received.amount ? "text-[var(--primary)]" : ""} note={`${totals.received.orders} live Razorpay ${totals.received.orders === 1 ? "payment" : "payments"}`} />
        <StatTile label="Refunded" value={rupees(totals.refunded.amount)} note={`${totals.refunded.orders} ${totals.refunded.orders === 1 ? "order" : "orders"}`} />
        <StatTile label="Awaiting payment" value={String(totals.pending.orders)} note={`${rupees(totals.pending.amount)} if all were paid`} />
        <StatTile label="Test mode" value={String(totals.testMode.orders)} note="Razorpay test payments, no money" />
        <StatTile label="No charge" value={String(totals.noCharge.orders)} note="Free starts and staff tests" />
      </section>

      <Panel title={count ? `Orders ${((filters.page - 1) * PAGE_SIZE + 1).toLocaleString("en-IN")}–${Math.min(filters.page * PAGE_SIZE, count).toLocaleString("en-IN")} of ${count.toLocaleString("en-IN")}` : "No orders match"}>
        {rows.length > 0 && (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Placed</th><th className={th}>Customer</th><th className={thNumber}>Amount</th><th className={th}>State</th><th className={th}>Payment</th><th className={th}>Billing contact</th><th className={th}>Account</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((order) => (
                  <tr key={order.id} className="align-top hover:bg-[var(--card-raised)]">
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(order.createdAt)}<p className="max-w-[8.5rem] truncate font-mono text-[10px]" title={order.id}>{order.id}</p></td>
                    <td className={`${td} max-w-[12rem]`}><Link href={`/admin/customers/${order.user.id}`} className="block truncate hover:underline">{order.user.name ?? order.user.email}</Link>{order.user.name && <p className="truncate text-[11px] text-[var(--muted)]">{order.user.email}</p>}</td>
                    <td className={tdNumber}>{rupees(order.amount)}<p className="text-[11px] text-[var(--muted)]">{findAccountPlan(order.planId)?.label ?? order.planId} account</p></td>
                    <td className={`${td} ${moneyReceived(order) ? "font-medium text-[var(--primary)]" : order.status === "FAILED" ? "text-[var(--danger)]" : ""}`}>{orderStateLabel(order.provider, order.status)}<p className="text-[11px] font-normal text-[var(--muted)]">{PROVIDER_LABELS[order.provider] ?? order.provider}</p>{order.paidAt && <p className="text-[11px] font-normal text-[var(--muted)]">{istDateTime(order.paidAt)}</p>}</td>
                    <td className={`${td} font-mono text-[11px] text-[var(--muted)]`}>{order.providerPaymentId ?? DASH}{order.providerOrderId?.startsWith("order_") && <p>{order.providerOrderId}</p>}</td>
                    <td className={`${td} max-w-[12rem] text-xs`}><p className="truncate">{order.billingName ?? DASH}</p><p className="truncate text-[var(--muted)]" title={order.billingEmail}>{order.billingEmail}</p>{order.billingPhone && <p className="text-[var(--muted)]">{order.billingPhone}</p>}{order.billingState && <p className="truncate text-[var(--muted)]" title={order.billingState}>GST state: {order.billingState}</p>}</td>
                    <td className={td}>{order.account ? <Link href={`/admin/accounts/${order.account.id}`} className="font-mono text-xs hover:underline">{accountNumber(order.account.id, order.account.planId)}</Link> : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <Pager page={filters.page} count={count} pageSize={PAGE_SIZE} href={(page) => `/admin/billing${filterQuery(filters, page)}`} />
      </Panel>
    </div>
  );
}
