/**
 * Broker-specific importers for *transaction / order* exports — the ones that
 * carry no per-row realized P&L and so can't be auto-mapped like a Realized
 * Gain/Loss CSV. Each adapter parses its broker's columns into `RawTxn[]` and
 * runs the shared FIFO matcher ([fifo.ts](./fifo.ts)) to derive realized P&L.
 *
 * `BROKER_FORMATS` drives the import-format dropdown in the upload UI; "soon"
 * entries render disabled. `parseBrokerCsv` is the single dispatcher used by both
 * the client preview and the server import action, so they always agree.
 *
 * Auto-detect (IBKR Flex, E*TRADE / Fidelity Gain-Loss, manual template) stays
 * in [parse.ts](./parse.ts); this module is only for the FIFO-matched formats.
 */
import Papa from "papaparse";
import { normalizeDate, parseNumber, type ParsedTrade, type ParseError } from "./parse";
import { isOptionSymbol, matchFifo, norm, type RawTxn } from "./fifo";

export interface BrokerParseResult {
  trades: ParsedTrade[]; // closed round-trips with realized P&L
  errors: ParseError[]; // rows that looked like trades but were malformed
  fills: number; // tradeable fills read from the file
  matched: number; // = trades.length (closed round-trips)
  openPositions: number; // contracts/symbols still open (no realized P&L yet)
}

export interface BrokerFormat {
  id: string;
  label: string;
  /** "ready" → selectable; "soon" → shown disabled as a "coming soon" teaser. */
  status: "ready" | "soon";
  /** Short broker name, used to pre-fill a new account's broker from the format. */
  broker?: string;
}

/** Drives the upload-page dropdown. `auto` is handled by parse.ts, not here. */
export const BROKER_FORMATS: BrokerFormat[] = [
  { id: "auto", label: "Auto-detect — IBKR Flex, E*TRADE / Fidelity Gain-Loss, manual", status: "ready" },
  { id: "fidelity", label: "Fidelity — Activity History", status: "ready", broker: "Fidelity" },
  { id: "webull", label: "Webull — Orders", status: "ready", broker: "Webull" },
  { id: "robinhood", label: "Robinhood", status: "soon", broker: "Robinhood" },
  { id: "schwab", label: "Charles Schwab / thinkorswim", status: "soon", broker: "Charles Schwab" },
  { id: "tastytrade", label: "tastytrade", status: "soon", broker: "tastytrade" },
];

/** Short broker name for a format id (for pre-filling a new account). */
export function brokerForFormat(format: string): string {
  return BROKER_FORMATS.find((f) => f.id === format)?.broker ?? "";
}

const empty = (message: string): BrokerParseResult => ({
  trades: [],
  errors: [{ row: 0, message }],
  fills: 0,
  matched: 0,
  openPositions: 0,
});

/** Strip a BOM and any leading blank/junk lines so PapaParse sees the header row. */
function cleanLeading(text: string): string {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") start++;
  return lines.slice(start).join("\n");
}

function parseRows(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const parsed = Papa.parse<Record<string, string>>(cleanLeading(text), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { rows: parsed.data, headers: parsed.meta.fields ?? [] };
}

/** Resolve canonical keys → actual header names by normalized alias (first wins). */
function pickColumns<K extends string>(
  headers: string[],
  aliases: Record<K, string[]>,
): Partial<Record<K, string>> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = norm(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }
  const out: Partial<Record<K, string>> = {};
  for (const key of Object.keys(aliases) as K[]) {
    for (const alias of aliases[key]) {
      const header = byNorm.get(alias);
      if (header) {
        out[key] = header;
        break;
      }
    }
  }
  return out;
}

const val = (row: Record<string, string>, header: string | undefined): string =>
  header ? (row[header] ?? "") : "";

// ── Fidelity: Accounts History (Activity) ──────────────────────────────────
//
// Run Date,Account,Account Number,Action,Symbol,Description,Type,Price ($),
// Quantity,Commission ($),Fees ($),Accrued Interest ($),Amount ($),Settlement Date
//
// Buys have +Quantity / negative Amount, sells −Quantity / positive Amount, and
// Amount is the *net* cash (already includes Commission + Fees). Options carry a
// leading "-" and a "(100 SHS)" / PUT|CALL description; the 100× multiplier is
// already baked into Amount, so per-unit value = Amount ∓ fees.

export function parseFidelityActivity(text: string): BrokerParseResult {
  const { rows, headers } = parseRows(text);
  const col = pickColumns(headers, {
    date: ["rundate", "date"],
    symbol: ["symbol"],
    action: ["action"],
    description: ["description"],
    quantity: ["quantity", "qty"],
    commission: ["commission"],
    fees: ["fees"],
    amount: ["amount"],
  });

  if (!col.date || !col.symbol || !col.action || !col.amount || !col.quantity) {
    return empty("This doesn't look like a Fidelity Activity History export (need Run Date, Action, Symbol, Quantity, Amount).");
  }

  const txns: RawTxn[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, i) => {
    const action = val(row, col.action).trim();
    // Only buys/sells become trades; dividends, fund "Exchanges", interest, and
    // the trailing disclaimer rows are skipped silently.
    if (!/\b(bought|sold)\b/i.test(action)) return;

    const symbolRaw = val(row, col.symbol).trim();
    const qty = parseNumber(val(row, col.quantity));
    const amount = parseNumber(val(row, col.amount));
    const date = normalizeDate(val(row, col.date));
    if (!symbolRaw || qty == null || qty === 0 || amount == null || !date) {
      errors.push({ row: i + 1, message: "skipped: missing/invalid symbol, quantity, amount, or date" });
      return;
    }

    const legFees =
      Math.abs(parseNumber(val(row, col.commission)) ?? 0) +
      Math.abs(parseNumber(val(row, col.fees)) ?? 0);
    const absQty = Math.abs(qty);
    // buy: |amount| = gross + fees ; sell: amount = gross − fees → gross = |amount| ∓ fees
    const grossTotal = Math.abs(amount) + (qty < 0 ? legFees : -legFees);
    const isOption =
      symbolRaw.startsWith("-") ||
      /\b(put|call)\b/i.test(action) ||
      /\b(put|call)\b/i.test(val(row, col.description));

    txns.push({
      idx: i,
      date,
      symbol: symbolRaw.replace(/^-/, "").trim(),
      assetType: isOption ? "option" : "stock",
      signedQty: qty,
      grossPerUnit: grossTotal / absQty,
      feePerUnit: legFees / absQty,
      openClose: /opening/i.test(action) ? "open" : /closing/i.test(action) ? "close" : undefined,
      raw: row,
    });
  });

  const { trades, openPositions } = matchFifo(txns);
  return { trades, errors, fills: txns.length, matched: trades.length, openPositions };
}

// ── Webull: Orders export ──────────────────────────────────────────────────
//
// Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,
// Placed Time,Filled Time
//
// Transaction export — no realized P&L, and Webull does NOT include commissions
// or fees, so fees are 0 here (users can add them later). There's no cash
// "Amount" column either, so per-unit value = Avg Price × multiplier (×100 for
// options). We keep only filled orders and use Filled Time as the trade date.

export function parseWebullOrders(text: string): BrokerParseResult {
  const { rows, headers } = parseRows(text);
  const col = pickColumns(headers, {
    date: ["filledtime", "placedtime", "time", "date"],
    symbol: ["symbol", "ticker"],
    name: ["name", "description"],
    side: ["side", "action", "buysell"],
    status: ["status"],
    qty: ["filled", "filledqty", "quantity", "qty", "totalqty"],
    price: ["avgprice", "averagefillprice", "avgfillprice", "price"],
  });

  if (!col.date || !col.symbol || !col.side || !col.qty || !col.price) {
    return empty("This doesn't look like a Webull Orders export (need Symbol, Side, Filled, Avg Price, Filled Time).");
  }

  const txns: RawTxn[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, i) => {
    const status = val(row, col.status).trim();
    // Drop anything that didn't actually fill.
    if (status && /cancel|expire|pending|working|queued|fail|reject/i.test(status)) return;

    const sideRaw = val(row, col.side).trim();
    const dir = /^s|sell|sld|short/i.test(sideRaw) ? -1 : /^b|buy|bot|long/i.test(sideRaw) ? 1 : 0;
    if (!dir) return; // not a buy/sell row

    const qty = Math.abs(parseNumber(val(row, col.qty)) ?? 0);
    const price = parseNumber(val(row, col.price));
    const date = normalizeDate(val(row, col.date));
    const symbolRaw = val(row, col.symbol).trim();
    if (!symbolRaw || qty === 0 || price == null || !date) {
      errors.push({ row: i + 1, message: "skipped: missing/invalid symbol, filled qty, avg price, or date" });
      return;
    }

    const name = val(row, col.name);
    const isOption =
      /\b(call|put)\b/i.test(name) || /\b(call|put)\b/i.test(symbolRaw) || isOptionSymbol(symbolRaw);
    const multiplier = isOption ? 100 : 1;
    // If the Symbol is just the underlying for an option, fall back to the more
    // specific Name so different contracts don't get FIFO-merged together.
    const key = isOption && !isOptionSymbol(symbolRaw) && name.trim() ? name.trim() : symbolRaw;

    txns.push({
      idx: i,
      date,
      symbol: key,
      assetType: isOption ? "option" : "stock",
      signedQty: dir * qty,
      grossPerUnit: price * multiplier,
      feePerUnit: 0, // Webull omits commissions/fees
      raw: row,
    });
  });

  const { trades, openPositions } = matchFifo(txns);
  return { trades, errors, fills: txns.length, matched: trades.length, openPositions };
}

/** Dispatch a FIFO-matched broker format by id. `auto` is not handled here. */
export function parseBrokerCsv(format: string, text: string): BrokerParseResult {
  switch (format) {
    case "fidelity":
      return parseFidelityActivity(text);
    case "webull":
      return parseWebullOrders(text);
    default:
      return empty(`Unsupported import format: ${format}`);
  }
}

/**
 * Best-effort guess of the broker format from a file's headers, so the dropdown
 * can pre-select when the user drops a recognized export. Returns null when it
 * looks like a realized-P&L CSV (handled by auto-detect) or is unknown.
 */
export function detectBrokerFormat(text: string): string | null {
  const { headers } = parseRows(text);
  const set = new Set(headers.map(norm));
  const has = (n: string) => set.has(n);

  // Fidelity Activity: distinctive Run Date + Action + Amount (no realized P&L).
  if (has("rundate") && has("action") && has("amount")) return "fidelity";

  // Webull Orders: Side + a filled/avg-price/filled-time fingerprint.
  const webullish =
    has("side") &&
    (has("filledtime") || has("placedtime")) &&
    (has("avgprice") || has("averagefillprice") || has("filled"));
  if (webullish) return "webull";

  return null;
}
