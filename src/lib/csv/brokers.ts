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
import { chargesForFill, scheduleFor, type ChargesSchedule } from "@/lib/trading/charges";
import { CHARGES_SCHEDULES } from "@/lib/trading/charges-schedules";
import type { Exchange, InstrumentKind, Side } from "@/lib/trading/instruments";
import type { Paise } from "@/lib/trading/money";
import { toIst } from "@/lib/trading/time";
import { normalizeDate, parseNumber, type ParsedTrade, type ParseError } from "./parse";
import { isOptionSymbol, matchFifo, norm, type RawTxn } from "./fifo";

export interface BrokerParseResult {
  trades: ParsedTrade[]; // closed round-trips with realized P&L
  errors: ParseError[]; // rows that looked like trades but were malformed
  fills: number; // tradeable fills read from the file
  matched: number; // = trades.length (closed round-trips)
  openPositions: number; // contracts/symbols still open (no realized P&L yet)
  notes?: string[]; // non-fatal notes on the numbers (estimated charges, expiries)
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
  { id: "auto", label: "Auto-detect broker statement/export", status: "ready" },
  { id: "zerodha", label: "Zerodha — Console tradebook", status: "ready", broker: "Zerodha" },
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

// ── Zerodha: Console tradebook ─────────────────────────────────────────────
//
// symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,
// price,trade_id,order_id,order_execution_time,expiry_date
//
// One row per fill (an order can fill in several rows), quantity in units, not
// lots. F&O rows carry segment FO and an expiry date, and their exchange is NSE
// or BSE. The file has no charges, so F&O charges are estimated per order from
// the dated Zerodha rate card the simulator charges with
// (src/lib/trading/charges-schedules.ts); equity charges stay at zero. Options
// held to expiry settle outside the tradebook: they stay open and are reported,
// never priced.

const FO_EXCHANGE: Record<string, Exchange> = { NSE: "NFO", NFO: "NFO", BSE: "BFO", BFO: "BFO" };

const noteDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** CE / PE / FUT from a Zerodha F&O symbol such as NIFTY2560524750PE or NIFTY25JUNFUT. */
function contractKind(symbol: string): InstrumentKind | null {
  const match = /(CE|PE|FUT)$/.exec(symbol);
  return match ? (match[1] as InstrumentKind) : null;
}

/** The charges schedule in force on a date, or null before the first one. */
function scheduleOn(date: string): ChargesSchedule | null {
  try {
    return scheduleFor(date, CHARGES_SCHEDULES);
  } catch {
    return null;
  }
}

interface ZerodhaFill {
  idx: number;
  date: string;
  time: string;
  symbol: string;
  side: Side;
  units: number;
  pricePaise: Paise;
  orderId: string;
  derivative: boolean;
  kind: InstrumentKind | null;
  exchange: Exchange | null;
  raw: Record<string, string>;
}

export interface ZerodhaOptions {
  /** IST date that decides whether an open F&O position has expired (default: today). */
  today?: string;
  /** Keep only fills on these symbols; the rest are counted in a note. */
  include?: (symbol: string) => boolean;
}

export function parseZerodhaTradebook(text: string, options: ZerodhaOptions = {}): BrokerParseResult {
  const today = options.today ?? toIst(Date.now()).date;
  const { rows, headers } = parseRows(text);
  const col = pickColumns(headers, {
    symbol: ["symbol", "tradingsymbol"],
    date: ["tradedate"],
    exchange: ["exchange"],
    segment: ["segment"],
    side: ["tradetype"],
    quantity: ["quantity"],
    price: ["price"],
    orderId: ["orderid"],
    time: ["orderexecutiontime"],
    expiry: ["expirydate"],
  });

  if (!col.symbol || !col.date || !col.side || !col.quantity || !col.price) {
    return empty("This doesn't look like a Zerodha Console tradebook (need symbol, trade_date, trade_type, quantity, price).");
  }

  const fills: ZerodhaFill[] = [];
  const errors: ParseError[] = [];
  let excluded = 0;

  rows.forEach((row, i) => {
    const sideRaw = val(row, col.side).trim().toLowerCase();
    const side: Side | null = sideRaw === "buy" ? "BUY" : sideRaw === "sell" ? "SELL" : null;
    const symbol = val(row, col.symbol).trim().toUpperCase();
    const units = parseNumber(val(row, col.quantity));
    const price = parseNumber(val(row, col.price));
    const date = normalizeDate(val(row, col.date));
    if (!side || !symbol || units == null || units <= 0 || price == null || price < 0 || !date) {
      errors.push({ row: i + 1, message: "skipped: missing/invalid symbol, trade type, quantity, price, or date" });
      return;
    }
    if (options.include && !options.include(symbol)) {
      excluded += 1;
      return;
    }

    const segment = val(row, col.segment).trim().toUpperCase();
    const derivative = segment ? /^(FO|F&O|NFO|BFO)$/.test(segment) : contractKind(symbol) !== null && val(row, col.expiry).trim() !== "";
    fills.push({
      idx: i,
      date,
      time: val(row, col.time).trim(),
      symbol,
      side,
      units,
      pricePaise: Math.round(price * 100),
      orderId: val(row, col.orderId).trim(),
      derivative,
      kind: derivative ? contractKind(symbol) : null,
      exchange: derivative ? (FO_EXCHANGE[val(row, col.exchange).trim().toUpperCase()] ?? null) : null,
      raw: row,
    });
  });

  // Brokerage is charged once per order, so walk the fills in execution order and
  // carry each order's turnover and brokerage so far.
  fills.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0) || a.idx - b.idx);
  const orders = new Map<string, { turnover: Paise; brokerage: Paise }>();
  let estimated = 0;
  let early = 0;
  let unrecognised = 0;
  let equity = 0;

  const txns: RawTxn[] = fills.map((fill) => {
    let fee: Paise = 0;
    const schedule = fill.kind && fill.exchange ? scheduleOn(fill.date) : null;
    if (fill.kind && fill.exchange && schedule) {
      const key = fill.orderId || `row-${fill.idx}`;
      const before = orders.get(key) ?? { turnover: 0, brokerage: 0 };
      const turnover = Math.round(fill.pricePaise * fill.units);
      const charges = chargesForFill(
        { kind: fill.kind, exchange: fill.exchange, side: fill.side, turnover, orderTurnoverBefore: before.turnover, brokerageChargedBefore: before.brokerage },
        schedule,
      );
      orders.set(key, { turnover: before.turnover + turnover, brokerage: before.brokerage + charges.brokerage });
      fee = charges.total;
      estimated += 1;
    } else if (fill.derivative) {
      if (fill.kind && fill.exchange) early += 1;
      else unrecognised += 1;
    } else {
      equity += 1;
    }
    return {
      idx: fill.idx,
      date: fill.date,
      time: fill.time || undefined,
      symbol: fill.symbol,
      assetType: !fill.derivative ? "stock" : fill.kind === "FUT" ? "future" : "option",
      signedQty: fill.side === "BUY" ? fill.units : -fill.units,
      grossPerUnit: fill.pricePaise / 100,
      feePerUnit: fee / 100 / fill.units,
      raw: fill.raw,
    };
  });

  const { trades, openLots } = matchFifo(txns);
  const expired = openLots.filter((lot) => {
    const expiry = normalizeDate(val(lot.raw, col.expiry));
    return expiry !== null && expiry < today;
  }).length;
  const stillOpen = openLots.length - expired;
  const firstSchedule = CHARGES_SCHEDULES.reduce((first, schedule) => (schedule.effectiveFrom < first ? schedule.effectiveFrom : first), CHARGES_SCHEDULES[0].effectiveFrom);

  const notes: string[] = [];
  if (estimated > 0) notes.push("F&O charges are estimated from Zerodha's published rates; your contract notes have the exact amounts.");
  if (early > 0) notes.push(`${plural(early, "F&O fill")} before ${noteDate.format(new Date(firstSchedule))} count before charges: no rate card is on file for those dates.`);
  if (unrecognised > 0) notes.push(`${plural(unrecognised, "F&O fill")} on contracts we couldn't read count before charges.`);
  if (equity > 0) notes.push(`${plural(equity, "equity fill")} count before charges: equity charges aren't estimated.`);
  if (excluded > 0) notes.push(`${plural(excluded, "fill")} outside the contracts counted here were left out.`);
  if (expired > 0) notes.push(`${plural(expired, "position")} reached expiry without a closing trade. Zerodha settles those outside the tradebook, so their result isn't counted.`);
  if (stillOpen > 0) notes.push(`${plural(stillOpen, "position")} still open: ${stillOpen === 1 ? "it counts" : "they count"} once closed.`);

  return { trades, errors, fills: txns.length, matched: trades.length, openPositions: openLots.length, notes };
}

/** Dispatch a FIFO-matched broker format by id. `auto` is not handled here. */
export function parseBrokerCsv(format: string, text: string): BrokerParseResult {
  switch (format) {
    case "zerodha":
      return parseZerodhaTradebook(text);
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

  // Zerodha Console tradebook: trade_type + order_execution_time.
  if (has("tradetype") && has("orderexecutiontime")) return "zerodha";

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
