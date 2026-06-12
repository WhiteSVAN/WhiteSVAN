/**
 * CSV import — flexible column mapping with broker presets.
 *
 * Strategy: parse with PapaParse (header mode), then map the user's columns onto
 * our canonical fields. Ship an Interactive Brokers preset plus a universal
 * manual template; users can always override the mapping in the UI.
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

export interface Preset {
  id: string;
  label: string;
  mapping: ColumnMapping;
}

/** Interactive Brokers Activity/Flex "Trades" style headers. */
export const IBKR_PRESET: Preset = {
  id: "ibkr",
  label: "Interactive Brokers",
  mapping: {
    tradeDate: "Date/Time",
    symbol: "Symbol",
    assetType: "Asset Category",
    quantity: "Quantity",
    entryPrice: "T. Price",
    exitPrice: "C. Price",
    realizedPnl: "Realized P/L",
    fees: "Comm/Fee",
  },
};

/** Universal manual template: headers equal canonical field names. */
export const MANUAL_PRESET: Preset = {
  id: "manual",
  label: "Manual template",
  mapping: {
    tradeDate: "trade_date",
    symbol: "symbol",
    assetType: "asset_type",
    side: "side",
    quantity: "quantity",
    entryPrice: "entry_price",
    exitPrice: "exit_price",
    realizedPnl: "realized_pnl",
    fees: "fees",
    accountName: "account_name",
  },
};

export const PRESETS: Preset[] = [IBKR_PRESET, MANUAL_PRESET];

/** Guess a preset by how many of its source headers are present. */
export function detectPreset(headers: string[]): Preset | null {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  let best: { preset: Preset; hits: number } | null = null;
  for (const preset of PRESETS) {
    const sources = Object.values(preset.mapping).filter(Boolean) as string[];
    const hits = sources.filter((s) => set.has(s.toLowerCase())).length;
    if (hits >= 2 && (!best || hits > best.hits)) best = { preset, hits };
  }
  return best?.preset ?? null;
}

/** Normalize broker date formats to `YYYY-MM-DD`. Returns null if unparseable. */
export function normalizeDate(value: string): string | null {
  if (!value) return null;
  // IBKR uses "YYYY-MM-DD, HH:MM:SS"; also handle space-separated time.
  const datePart = value.trim().split(/[,\sT]/)[0];
  // ISO YYYY-MM-DD
  let m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
      fees: parseNumber(get(row, "fees")) ?? 0,
      accountName: get(row, "accountName")?.trim() || undefined,
      raw: row,
    });
  });

  return { headers, trades, errors };
}
