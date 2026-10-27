import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pager, Panel, StatTile, TableScroll, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { fillsPage } from "@/lib/admin/book";
import { PAGE_SIZE, fillFilters, filterQuery, type Params } from "@/lib/admin/filters";
import { DASH, istDateTime, rupees, signedRupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Trades · Admin · WhiteSVAN" };

const REASONS = { ORDER: "Order", SQUARE_OFF: "Square-off", BREACH: "Breach" } as const;

/** Every fill on every account, filtered by date, trader, account, contract, side and why it filled, with a CSV export. */
export default async function AdminTradesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  const filters = fillFilters(await searchParams);
  logger.info("admin.view", { adminId: admin.id, view: "trades", filters });
  const { rows, count, realised, charges } = await fillsPage(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Trades</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Every fill on every demo and funded account, recorded when it happened, with its charges and the balance after it. Times and dates are IST.</p>
      </div>

      <FilterBar
        reset="/admin/trades"
        fields={[
          { name: "from", label: "From", type: "date", value: filters.from },
          { name: "to", label: "To", type: "date", value: filters.to },
          { name: "q", label: "Trader", value: filters.q, placeholder: "Name or email", width: "w-48" },
          { name: "symbol", label: "Contract", value: filters.symbol, placeholder: "NIFTY…", width: "w-36" },
          { name: "side", label: "Side", value: filters.side, options: [["BUY", "Buy"], ["SELL", "Sell"]] },
          { name: "reason", label: "Why", value: filters.reason, options: Object.entries(REASONS) },
          ...(filters.account ? [{ name: "account", label: "Account", value: filters.account, width: "w-48" }] : []),
        ]}
      >
        <a href={`/admin/trades/export${filterQuery({ ...filters, page: 1 })}`} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm hover:bg-[var(--card-raised)]"><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</a>
      </FilterBar>

      <section aria-label="Totals" className="grid grid-cols-3 gap-3">
        <StatTile label="Fills" value={count.toLocaleString("en-IN")} />
        <StatTile label="Realised before charges" value={signedRupees(realised)} valueClass={tone(realised)} />
        <StatTile label="Charges" value={rupees(charges)} />
      </section>

      <Panel title={count ? `Fills ${((filters.page - 1) * PAGE_SIZE + 1).toLocaleString("en-IN")}–${Math.min(filters.page * PAGE_SIZE, count).toLocaleString("en-IN")} of ${count.toLocaleString("en-IN")}` : "No fills match"}>
        {rows.length > 0 && (
          <TableScroll>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]"><th className={th}>Time</th><th className={th}>Trader</th><th className={th}>Account</th><th className={th}>Contract</th><th className={th}>Side</th><th className={thNumber}>Units</th><th className={thNumber}>Price</th><th className={th}>Why</th><th className={thNumber}>Realised</th><th className={thNumber}>Charges</th><th className={thNumber}>Balance after</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((fill) => (
                  <tr key={fill.id} className="hover:bg-[var(--card-raised)]">
                    <td className={`${td} text-xs text-[var(--muted)]`}>{istDateTime(fill.at)}</td>
                    <td className={td}><Link href={`/admin/customers/${fill.user.id}`} className="hover:underline">{fill.user.name ?? fill.user.email}</Link></td>
                    <td className={td}><Link href={`/admin/accounts/${fill.accountId}`} className="font-mono text-xs hover:underline">{accountNumber(fill.accountId, fill.account.planId)}</Link></td>
                    <td className={`${td} font-mono text-xs`}>{fill.tradingSymbol}</td>
                    <td className={`${td} text-xs font-medium ${fill.side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{fill.side === "BUY" ? "Buy" : "Sell"}</td>
                    <td className={tdNumber}>{fill.quantity}</td>
                    <td className={tdNumber}>{rupees(fill.price, 2)}</td>
                    <td className={`${td} text-xs`}>{REASONS[fill.reason as keyof typeof REASONS] ?? fill.reason}</td>
                    <td className={`${tdNumber} ${tone(fill.realised)}`}>{fill.realised ? signedRupees(fill.realised, 2) : DASH}</td>
                    <td className={tdNumber}>{rupees(fill.chargesTotal, 2)}</td>
                    <td className={tdNumber}>{rupees(fill.balanceAfter, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <Pager page={filters.page} count={count} pageSize={PAGE_SIZE} href={(page) => `/admin/trades${filterQuery(filters, page)}`} />
      </Panel>
    </div>
  );
}
