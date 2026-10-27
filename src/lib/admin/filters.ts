/**
 * The admin portal's filters, read from the address (pure): a page is a link, so a filtered view can
 * be shared and reloaded. Anything malformed is dropped, never passed to a query.
 */
import type { AccountEventKind } from "@/generated/prisma/client";
import { istInstant } from "@/lib/trading/time";

export const PAGE_SIZE = 100;

export const EVENT_KINDS = ["ORDER_PLACED", "ORDER_MODIFIED", "ORDER_CANCELLED", "ORDER_REJECTED", "ORDER_REFUSED", "BREACH", "PASSED"] as const satisfies readonly AccountEventKind[];

export const EVENT_LABELS: Record<AccountEventKind, string> = {
  ORDER_PLACED: "Order placed",
  ORDER_MODIFIED: "Order modified",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_REJECTED: "Order rejected",
  ORDER_REFUSED: "Refused by policy",
  BREACH: "Breach",
  PASSED: "Passed",
};

export type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
const isDate = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export interface Common {
  /** IST dates, inclusive. */
  from?: string;
  to?: string;
  /** Part of a trader's email or name. */
  q?: string;
  account?: string;
  page: number;
}

function common(params: Params): Common {
  const page = Number(first(params.page));
  const q = first(params.q)?.slice(0, 100);
  const account = first(params.account);
  return {
    from: isDate(first(params.from)) ? first(params.from) : undefined,
    to: isDate(first(params.to)) ? first(params.to) : undefined,
    q,
    account: account && /^[\w-]{1,64}$/.test(account) ? account : undefined,
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

export interface FillFilters extends Common {
  symbol?: string;
  side?: "BUY" | "SELL";
  reason?: "ORDER" | "SQUARE_OFF" | "BREACH";
}

export function fillFilters(params: Params): FillFilters {
  const side = first(params.side);
  const reason = first(params.reason);
  const symbol = first(params.symbol)?.toUpperCase().slice(0, 40);
  return {
    ...common(params),
    symbol: symbol && /^[A-Z0-9 -]+$/.test(symbol) ? symbol : undefined,
    side: side === "BUY" || side === "SELL" ? side : undefined,
    reason: reason === "ORDER" || reason === "SQUARE_OFF" || reason === "BREACH" ? reason : undefined,
  };
}

export interface EventFilters extends Common {
  kind?: AccountEventKind;
}

export function eventFilters(params: Params): EventFilters {
  const kind = first(params.kind);
  return { ...common(params), kind: (EVENT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as AccountEventKind) : undefined };
}

/** The UTC instants an IST date range covers: from the start of `from` to the end of `to`. */
export function istRange(from: string | undefined, to: string | undefined): { gte?: Date; lt?: Date } {
  return {
    ...(from ? { gte: new Date(istInstant(from, 0)) } : {}),
    ...(to ? { lt: new Date(istInstant(to, 0) + 86_400_000) } : {}),
  };
}

/** The same filters as query parameters, for links and the CSV export; `page` overrides. */
export function filterQuery(filters: object, page?: number): string {
  const values: [string, unknown][] = Object.entries({ ...filters, page: page ?? (filters as { page?: number }).page });
  const entries = values
    .filter(([key, value]) => value !== undefined && value !== "" && !(key === "page" && value === 1))
    .map(([key, value]) => [key, String(value)]);
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}
