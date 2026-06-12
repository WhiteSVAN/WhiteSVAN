/**
 * CSV import — automatic column detection with broker-aware aliases.
 *
 * Strategy: parse with PapaParse (header mode), then auto-map the user's columns
 * onto our canonical fields by matching header names (case/space/punctuation
 * insensitive) against known aliases. This recognizes IBKR Flex Query exports
 * ("select all" included), IBKR Activity statements, and our manual template
 * without the user mapping anything. The UI still lets them override.
 */
import Papa from "papaparse";

export const CANONICAL_FIELDS = [
  "tradeDate",
  "symbol",
  "assetType",
  "side",
  "quantity",
  "entryPrice",
  "exitPrice",
  "realizedPnl",
  "fees",
  "accountName",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_FIELDS: CanonicalField[] = ["tradeDate", "symbol", "realizedPnl"];

/** Maps a canonical field → the source CSV header that feeds it. */
export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export interface ParsedTrade {
  tradeDate: string; // normalized YYYY-MM-DD
  symbol: string;
  assetType?: string;
  side?: string;
  quantity?: number;
  entryPrice?: number;
  exitPrice?: number;
  realizedPnl: number;
  fees: number;
  accountName?: string;
  raw: Record<string, string>;
}

export interface ParseError {
  row: number; // 1-based data row
  message: string;
}

export interface ParseResult {
  headers: string[];
  trades: ParsedTrade[];
  errors: ParseError[];
}

/** Lowercase, strip non-alphanumerics — so "Realized P/L", "realized_pnl" and
 *  "FifoPnlRealized" can be compared on equal footing. */
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Known header aliases per canonical field, in priority order. Stored in
 * normalized form (see `norm`). Covers IBKR Flex field names (e.g.
 * `FifoPnlRealized`, `IBCommission`, `Buy/Sell`, `ClosePrice`), IBKR Activity
 * statement names (`Realized P/L`, `Comm/Fee`, `T. Price`), and the manual
 * template (`realized_pnl`, `trade_date`, …).
 */
const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  tradeDate: ["tradedate", "tradedatetime", "date", "datetime"],
  symbol: ["symbol", "ticker", "instrument", "localsymbol"],
  assetType: ["assetclass", "assetcategory", "assettype", "sectype", "securitytype"],
  side: ["buysell", "side", "action", "bs", "direction"],
  quantity: ["quantity", "qty", "shares", "size", "filledquantity"],
  entryPrice: ["tradeprice", "tprice", "price", "entryprice", "avgprice", "fillprice"],
  exitPrice: ["closeprice", "cprice", "exitprice"],
  realizedPnl: ["fifopnlrealized", "realizedpnl", "realizedpl", "realizedplmtm", "realizedpandl"],
  fees: ["ibcommission", "commission", "commfee", "commissionfee", "fees", "fee", "commissions"],
  accountName: ["clientaccountid", "accountalias", "accountid", "accountname", "account"],
};

/** Auto-detect a column mapping from CSV headers. First alias match wins. */
export function autoMap(headers: string[]): ColumnMapping {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = norm(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h); // first header wins on collision
  }

  const mapping: ColumnMapping = {};
  for (const field of CANONICAL_FIELDS) {
    for (const alias of FIELD_ALIASES[field]) {
      const header = byNorm.get(alias);
      if (header) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

/** Normalize broker date formats to `YYYY-MM-DD`. Returns null if unparseable. */
export function normalizeDate(value: string): string | null {
  if (!value) return null;
  // Date portion before any time separator: space, comma, 'T', or IBKR's ';'.
  const datePart = value.trim().split(/[,\sT;]/)[0];
  // Compact YYYYMMDD (IBKR Flex)
  let m = datePart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // ISO YYYY-MM-DD
  m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // US M/D/YYYY or MM/DD/YYYY
  m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // YYYY/MM/DD
  m = datePart.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

/** Parse a number, tolerating commas, currency symbols, and (parenthesized) negatives. */
export function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  let s = value.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Parse CSV text into canonical trades using the given column mapping.
 * Rows missing a required field are reported in `errors` and skipped.
 */
export function parseTradesCsv(text: string, mapping: ColumnMapping): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const trades: ParsedTrade[] = [];
  const errors: ParseError[] = [];

  const get = (row: Record<string, string>, field: CanonicalField): string | undefined => {
    const src = mapping[field];
    return src ? row[src] : undefined;
  };

  parsed.data.forEach((row, i) => {
    const rowNum = i + 1;
    const rawDate = get(row, "tradeDate");
    const date = rawDate ? normalizeDate(rawDate) : null;
    const symbol = get(row, "symbol")?.trim();
    const realizedPnl = parseNumber(get(row, "realizedPnl"));

    const missing: string[] = [];
    if (!date) missing.push("tradeDate");
    if (!symbol) missing.push("symbol");
    if (realizedPnl == null) missing.push("realizedPnl");
    if (missing.length) {
      errors.push({ row: rowNum, message: `missing/invalid: ${missing.join(", ")}` });
      return;
    }

    trades.push({
      tradeDate: date!,
      symbol: symbol!,
      assetType: get(row, "assetType")?.trim() || undefined,
      side: get(row, "side")?.trim() || undefined,
      quantity: parseNumber(get(row, "quantity")) ?? undefined,
      entryPrice: parseNumber(get(row, "entryPrice")) ?? undefined,
      exitPrice: parseNumber(get(row, "exitPrice")) ?? undefined,
      realizedPnl: realizedPnl!,
      // Brokers report commissions as negative cash (IBKR) or positive cost
      // (manual). Store the magnitude as a cost so net = gross − fees is correct.
      fees: Math.abs(parseNumber(get(row, "fees")) ?? 0),
      accountName: get(row, "accountName")?.trim() || undefined,
      raw: row,
    });
  });

  return { headers, trades, errors };
}
