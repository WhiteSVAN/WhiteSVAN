import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/filter-bar";
import { KindBadge, Pager, Panel, TableScroll, eventSummary, td, th } from "@/components/admin/parts";
import { eventsPage } from "@/lib/admin/book";
import { EVENT_KINDS, EVENT_LABELS, PAGE_SIZE, eventFilters, filterQuery, type Params } from "@/lib/admin/filters";
import { istDateTime } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Audit log · Admin · WhiteSVAN" };

/** Everything that happened on every account: orders, refusals by the trading policy, breaches and passes. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  const filters = eventFilters(await searchParams);
  logger.info("admin.view", { adminId: admin.id, view: "audit", filters });
  const { rows, count } = await eventsPage(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Audit log</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Every order placed, changed, cancelled or rejected by the engine, every order the trading policy refused (such as a hedge across accounts), every breach and every pass. Recorded with the account&apos;s own write, never edited. Fills are under Trades.</p>
      </div>

      <FilterBar
        reset="/admin/audit"
        fields={[
          { name: "from", label: "From", type: "date", value: filters.from },
          { name: "to", label: "To", type: "date", value: filters.to },
          { name: "q", label: "Trader", value: filters.q, placeholder: "Name or email", width: "w-48" },
          { name: "kind", label: "What", value: filters.kind, options: EVENT_KINDS.map((kind) => [kind, EVENT_LABELS[kind]] as const) },
          ...(filters.account ? [{ name: "account", label: "Account", value: filters.account, width: "w-48" }] : []),
        ]}
      />

      <Panel title={count ? `${count.toLocaleString("en-IN")} ${count === 1 ? "event" : "events"}` : "No events match"}>
        {rows.length > 0 && (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Time</th><th className={th}>What</th><th className={th}>Trader</th><th className={th}>Account</th><th className={th}>Detail</th><th className={th}>Order</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-[var(--card-raised)]">
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(event.at)}</td>
                    <td className={td}><KindBadge kind={event.kind} /></td>
                    <td className={td}><Link href={`/admin/customers/${event.user.id}`} className="hover:underline">{event.user.name ?? event.user.email}</Link></td>
                    <td className={td}><Link href={`/admin/accounts/${event.accountId}`} className="font-mono text-xs hover:underline">{accountNumber(event.accountId, event.account.planId)}</Link></td>
                    <td className="min-w-72 px-3 py-2.5 text-sm">{eventSummary(event.kind, event.detail)}</td>
                    <td className={`${td} font-mono text-[11px] text-[var(--muted)]`}>{event.orderId ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <Pager page={filters.page} count={count} pageSize={PAGE_SIZE} href={(page) => `/admin/audit${filterQuery(filters, page)}`} />
      </Panel>
    </div>
  );
}
