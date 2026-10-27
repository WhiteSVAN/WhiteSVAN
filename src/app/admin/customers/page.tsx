import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pager, Panel, TableScroll, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { customersPage } from "@/lib/admin/customers";
import { CUSTOMER_SHOWS, PAGE_SIZE, customerFilters, filterQuery, type Params } from "@/lib/admin/filters";
import { DASH, istDate, rupees } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Customers · Admin · WhiteSVAN" };

/** Everyone who has signed up, newest first: how they sign in, who referred them, their accounts and what they've paid. */
export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  const filters = customerFilters(await searchParams);
  logger.info("admin.view", { adminId: admin.id, view: "customers", filters });
  const { rows, count } = await customersPage(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Customers</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Everyone who has signed up, with or without an account. &ldquo;Received&rdquo; counts only captured live Razorpay payments; test-mode, staff and free orders take no money.</p>
      </div>

      <FilterBar
        reset="/admin/customers"
        fields={[
          { name: "q", label: "Search", value: filters.q, placeholder: "Name, email or referral code", width: "w-60" },
          { name: "from", label: "Joined from", type: "date", value: filters.from },
          { name: "to", label: "Joined to", type: "date", value: filters.to },
          { name: "show", label: "Show", value: filters.show, options: Object.entries(CUSTOMER_SHOWS) },
        ]}
      />

      <Panel title={count ? `${count.toLocaleString("en-IN")} ${count === 1 ? "customer" : "customers"}` : "No customers match"}>
        {rows.length > 0 && (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Customer</th><th className={th}>Joined</th><th className={th}>Signs in with</th><th className={th}>Accounts</th><th className={thNumber}>Orders</th><th className={thNumber}>Received</th><th className={th}>Last order</th><th className={th}>Referral</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[var(--card-raised)]">
                    <td className={`${td} max-w-[15rem]`} title={customer.email ?? undefined}>
                      <Link href={`/admin/customers/${customer.id}`} className="block truncate font-medium hover:underline">{customer.name ?? customer.email}</Link>
                      {customer.name && <p className="truncate text-[11px] text-[var(--muted)]">{customer.email}</p>}
                      {customer.isAdmin && <p className="text-[11px] text-[var(--primary)]">Admin</p>}
                    </td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDate(customer.joined)}</td>
                    <td className={`${td} text-xs`}>{[customer.google && "Google", customer.password && "Password"].filter(Boolean).join(", ") || DASH}</td>
                    <td className={`${td} text-xs`}>{customer.accounts.total ? <>{customer.accounts.active} active, {customer.accounts.funded} funded<p className="text-[11px] text-[var(--muted)]">{customer.accounts.passed} passed, {customer.accounts.failed} failed</p></> : <span className="text-[var(--muted)]">None</span>}</td>
                    <td className={tdNumber}>{customer.orders}</td>
                    <td className={`${tdNumber} ${customer.received ? "font-medium text-[var(--primary)]" : ""}`}>{rupees(customer.received)}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDate(customer.lastOrderAt)}</td>
                    <td className={`${td} text-xs`}>
                      {customer.referralCode ? <span className="font-mono">{customer.referralCode}</span> : DASH}
                      {customer.referredBy && <p className="text-[11px] text-[var(--muted)]">By <Link href={`/admin/customers/${customer.referredBy.id}`} className="hover:underline">{customer.referredBy.name ?? customer.referredBy.email}</Link></p>}
                      {customer.referrals > 0 && <p className="text-[11px] text-[var(--muted)]">Referred {customer.referrals}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <Pager page={filters.page} count={count} pageSize={PAGE_SIZE} href={(page) => `/admin/customers${filterQuery(filters, page)}`} />
      </Panel>
    </div>
  );
}
