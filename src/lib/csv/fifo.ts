/**
 * FIFO round-trip matcher — turns a transaction/order export (buys & sells with
 * no per-row realized P&L) into the realized-P&L `ParsedTrade[]` the rest of the
 * app expects.
 *
 * Brokers like Fidelity (Activity History), Webull, and Robinhood export *what
 * you traded*, not *what you made*: each row is one fill, not a closed position.
 * To recover realized P&L we pair opening ↔ closing fills per contract/symbol in
 * first-in-first-out order and difference their per-unit value.
 *
 * Per the project's one rule — **code calculates numbers, AI only explains them**
 * — this is squarely on the calculation side. Each broker adapter normalizes its
 * rows into `RawTxn` (price/value already net of the broker's quirks) and hands
 * off to `matchFifo`; the matcher stays broker-agnostic.
 */
import type { ParsedTrade } from "./parse";

/** Lowercase + strip non-alphanumerics, so "Avg Price" == "avgprice". Shared by adapters. */
export const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Round to `dp` decimals, killing binary-float noise (e.g. 0.1 + 0.2). */
export const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Looks like an option contract symbol — OCC-ish: underlying + 6-digit date +
 * C/P + strike (e.g. `TSLA260608P400`, `SPY250117C00450000`, `-QQQ260610P690`).
 */
export const isOptionSymbol = (s: string): boolean =>
  /[A-Za-z.]{1,6}\d{6}[CP]\d{2,8}/.test(s.replace(/[\s-]/g, ""));

/**
 * One normalized fill. `grossPerUnit` is the per-unit dollar value *excluding*
 * fees with the contract multiplier already applied (so options are ×100), and
 * `feePerUnit` is commissions + fees per unit. Keeping value and fees separate
 * lets us store gross realized P&L and fees the same way the CSV path does
 * (net = gross − fees), so the metrics engine stays consistent across sources.
 */
export interface RawTxn {
  idx: number; // original row order, for a stable same-day tiebreak
  date: string; // normalized YYYY-MM-DD
  symbol: string; // contract/symbol — the FIFO grouping key
  assetType?: string; // "option" | "stock" | ...
  signedQty: number; // + buy / long, − sell / short
  grossPerUnit: number; // dollars per unit, fees excluded, multiplier applied
  feePerUnit: number; // commission + fees per unit
  openClose?: "open" | "close"; // explicit hint when the broker states it
  raw: Record<string, string>;
}

export interface FifoResult {
  trades: ParsedTrade[]; // one per closing fill that realized P&L
  openPositions: number; // lots still open at the end (no realized P&L yet)
}

interface Lot {
  qty: number;
  grossPerUnit: number;
  feePerUnit: number;
  dir: 1 | -1;
}

/**
 * Process order within a symbol: chronological, and within the same day open
 * before close (so an intraday round-trip pairs correctly regardless of how the
 * broker happened to order same-day rows). Falls back to buys-before-sells when
 * the broker gives no open/close hint, then original row order.
 */
function processRank(t: RawTxn): number {
  if (t.openClose === "open") return 0;
  if (t.openClose === "close") return 1;
  return t.signedQty > 0 ? 0 : 1;
}

/** Pair opening ↔ closing fills FIFO per symbol and emit realized-P&L trades. */
export function matchFifo(txns: RawTxn[]): FifoResult {
  const sorted = [...txns].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      processRank(a) - processRank(b) ||
      a.idx - b.idx,
  );

  const bySymbol = new Map<string, RawTxn[]>();
  for (const t of sorted) {
    const arr = bySymbol.get(t.symbol);
    if (arr) arr.push(t);
    else bySymbol.set(t.symbol, [t]);
  }

  const trades: ParsedTrade[] = [];
  let openPositions = 0;

  for (const [symbol, list] of bySymbol) {
    const open: Lot[] = [];

    for (const t of list) {
      const dir: 1 | -1 = t.signedQty > 0 ? 1 : -1;
      let remaining = Math.abs(t.signedQty);
      let grossPnl = 0;
      let fees = 0;
      let matched = 0;

      // Consume opposite-direction open lots FIFO — this fill closes them.
      while (remaining > 1e-9 && open.length > 0 && open[0].dir === -dir) {
        const lot = open[0];
        const q = Math.min(remaining, lot.qty);
        // Whichever leg is the buy is the cost; the sell is the proceeds.
        const sellGross = lot.dir === 1 ? t.grossPerUnit : lot.grossPerUnit;
        const buyGross = lot.dir === 1 ? lot.grossPerUnit : t.grossPerUnit;
        grossPnl += q * (sellGross - buyGross);
        fees += q * (lot.feePerUnit + t.feePerUnit);
        matched += q;
        lot.qty -= q;
        remaining -= q;
        if (lot.qty <= 1e-9) open.shift();
      }

      if (matched > 1e-9) {
        trades.push({
          tradeDate: t.date,
          symbol,
          assetType: t.assetType,
          side: dir === 1 ? "BUY" : "SELL", // the closing fill's own side
          quantity: round(matched, 4),
          realizedPnl: round(grossPnl, 2),
          fees: round(fees, 2),
          raw: t.raw,
        });
      }

      // Anything left over opens (or extends) a position in this fill's direction.
      if (remaining > 1e-9) {
        open.push({
          qty: remaining,
          grossPerUnit: t.grossPerUnit,
          feePerUnit: t.feePerUnit,
          dir,
        });
      }
    }

    openPositions += open.length;
  }

  trades.sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : a.tradeDate > b.tradeDate ? 1 : 0));
  return { trades, openPositions };
}
