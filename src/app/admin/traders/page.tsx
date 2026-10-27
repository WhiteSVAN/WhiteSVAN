import type { Metadata } from "next";
import Link from "next/link";
import { Panel, TableScroll, td, tdNumber, th, thNumber } from "@/components/admin/parts";
import { loadBook, type AdminTrader } from "@/lib/admin/book";
import type { Params } from "@/lib/admin/filters";
import { DASH, istDate, istDateTime, percent, ratio, signedRupees, tone } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Traders · Admin · WhiteSVAN" };

/** Sortable columns: each reads a number (null sorts last either way). */
const SORTS = {
  name: { label: "Trader", value: null },
  pnl: { label: "Net P&L", value: (trader: AdminTrader) => trader.netPnl },
  return: { label: "Return", value: (trader: AdminTrader) => trader.daily.totalReturn },
  days: { label: "Days", value: (trader: AdminTrader) => trader.daily.days },
  sharpe: { label: "Sharpe", value: (trader: AdminTrader) => trader.daily.sharpe },
  sortino: { label: "Sortino", value: (trader: AdminTrader) => trader.daily.sortino },
  drawdown: { label: "Max drawdown", value: (trader: AdminTrader) => trader.daily.maxDrawdownShare },
  winrate: { label: "Win rate", value: (trader: AdminTrader) => trader.trades.winRate },
  pf: { label: "Profit factor", value: (trader: AdminTrader) => trader.trades.profitFactor },
  expectancy: { label: "Expectancy", value: (trader: AdminTrader) => trader.trades.expectancy },
  last: { label: "Last trade", value: (trader: AdminTrader) => trader.lastActivity },
} as const;

type SortKey = keyof typeof SORTS;
const SHOWS = { all: "All traders", active: "With an active evaluation", funded: "With a funded account", flagged: "Flagged" } as const;
type Show = keyof typeof SHOWS;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function sorted(traders: AdminTrader[], key: SortKey, descending: boolean): AdminTrader[] {
  const read = SORTS[key].value;
  return [...traders].sort((a, b) => {
    if (!read) return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "") * (descending ? -1 : 1);
    const x = read(a);
    const y = read(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return descending ? y - x : x - y;
  });
}

/** Every trader with their accounts, P&L and risk-adjusted performance, sortable and filterable. */
export default async function AdminTradersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  logger.info("admin.view", { adminId: admin.id, view: "traders" });
  const params = await searchParams;
  const sortParam = first(params.sort);
  const key: SortKey = sortParam && sortParam in SORTS ? (sortParam as SortKey) : "last";
  // Figures sort highest first and names A to Z, unless the address says otherwise.
  const dir = first(params.dir);
  const descending = dir === "asc" ? false : dir === "desc" ? true : key !== "name";
  const showParam = first(params.show);
  const show: Show = showParam && showParam in SHOWS ? (showParam as Show) : "all";
  const q = first(params.q)?.trim().toLowerCase().slice(0, 100) ?? "";
  const { traders } = await loadBook();
  const shown = sorted(traders, key, descending).filter((trader) =>
    (!q || `${trader.name ?? ""} ${trader.email ?? ""}`.toLowerCase().includes(q)) &&
    (show === "all" || (show === "active" && trader.counts.active > 0) || (show === "funded" && trader.counts.funded > 0) || (show === "flagged" && (trader.nearLimit || trader.refusals > 0 || trader.breaches > 0))),
  );
  const link = (next: Partial<Record<"sort" | "dir" | "show" | "q", string>>) => {
    const query = new URLSearchParams(Object.entries({ sort: key, dir: descending ? "desc" : "asc", show, q, ...next }).filter(([, value]) => value) as [string, string][]);
    return `/admin/traders?${query}`;
  };
  const header = (column: SortKey, numeric = true) => {
    const current = column === key;
    const nextDir = current ? (descending ? "asc" : "desc") : column === "name" ? "asc" : "desc";
    return (
      <th className={numeric ? thNumber : th} aria-sort={current ? (descending ? "descending" : "ascending") : undefined}>
        <Link href={link({ sort: column, dir: nextDir })} className={`inline-flex items-center gap-1 hover:text-[var(--foreground)] ${current ? "text-[var(--foreground)]" : ""}`}>{SORTS[column].label}{current && <span aria-hidden="true">{descending ? "↓" : "↑"}</span>}</Link>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-[-0.03em] sm:text-4xl">Traders</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Each trader&apos;s accounts as one book: daily returns on the opening balances of the accounts that traded each day. Sharpe and Sortino are annualized over √252 trading days with a zero risk-free rate; win rate, profit factor and expectancy are per round trip, after charges.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter traders">
        <input type="hidden" name="sort" value={key} />
        <input type="hidden" name="dir" value={descending ? "desc" : "asc"} />
        <label className="text-xs text-[var(--muted)]">Search
          <input name="q" defaultValue={q} placeholder="Name or email" className="mt-1 block min-h-10 w-56 rounded-lg border border-[var(--border-strong)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]" />
        </label>
        <label className="text-xs text-[var(--muted)]">Show
          <select name="show" defaultValue={show} className="mt-1 block min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]">
            {Object.entries(SHOWS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]">Apply</button>
      </form>

      <Panel title={`${shown.length} ${shown.length === 1 ? "trader" : "traders"}`} note="A trader is flagged near a limit, or for a breach or an order the policy refused.">
        {shown.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No traders match.</p>
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {header("name", false)}
                  <th className={th}>Accounts</th>
                  {header("pnl")}
                  {header("days")}
                  {header("sharpe")}
                  {header("sortino")}
                  {header("drawdown")}
                  {header("winrate")}
                  {header("pf")}
                  {header("expectancy")}
                  {header("last")}
                  <th className={th}>Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shown.map((trader) => (
                  <tr key={trader.id} className="hover:bg-[var(--card-raised)]">
                    <td className={`${td} max-w-[13rem]`} title={trader.email ?? undefined}>
                      <Link href={`/admin/customers/${trader.id}`} className="block truncate font-medium hover:underline">{trader.name ?? trader.email}</Link>
                      {trader.name && <p className="truncate text-[11px] text-[var(--muted)]">{trader.email}</p>}
                    </td>
                    <td className={`${td} text-xs`}>
                      {trader.counts.active} active, {trader.counts.funded} funded
                      <p className="text-[11px] text-[var(--muted)]">{trader.counts.passed} passed, {trader.counts.failed} failed</p>
                    </td>
                    <td className={tdNumber}>
                      <span className={tone(trader.netPnl)}>{signedRupees(trader.netPnl)}</span>
                      <p className="text-[11px] text-[var(--muted)]">{trader.daily.days ? percent(trader.daily.totalReturn, 2) : DASH}</p>
                    </td>
                    <td className={tdNumber}>{trader.daily.days}</td>
                    <td className={`${tdNumber} font-semibold`}>{ratio(trader.daily.sharpe)}</td>
                    <td className={tdNumber}>{ratio(trader.daily.sortino)}</td>
                    <td className={tdNumber}>{trader.daily.days ? percent(trader.daily.maxDrawdownShare, 2) : DASH}</td>
                    <td className={tdNumber}>{percent(trader.trades.winRate, 0)}</td>
                    <td className={tdNumber}>{ratio(trader.trades.profitFactor)}</td>
                    <td className={`${tdNumber} ${tone(trader.trades.expectancy)}`}>{signedRupees(trader.trades.expectancy)}</td>
                    <td className={`${td} text-xs text-[var(--muted)]`} title={trader.lastActivity ? `${istDateTime(trader.lastActivity)} IST` : undefined}>{istDate(trader.lastActivity)}</td>
                    <td className={`${td} text-[11px]`}>
                      <span className="flex flex-wrap gap-1">
                        {trader.nearLimit && <span className="rounded-full border border-[var(--danger)]/50 px-2 py-0.5 text-[var(--danger)]">Near a limit</span>}
                        {trader.breaches > 0 && <span className="rounded-full border border-[var(--danger)]/50 px-2 py-0.5 text-[var(--danger)]">{trader.breaches} {trader.breaches === 1 ? "breach" : "breaches"}</span>}
                        {trader.refusals > 0 && <span className="rounded-full border border-[var(--warning)]/50 px-2 py-0.5 text-[var(--warning)]">{trader.refusals} refused</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}
