/**
 * How a trader lays out the trading platform on a laptop or desktop: the arrangement of its panels,
 * the side the chart sits on, which optional panels show, and the height of the orders window under
 * the chart. Saved in the browser, as a convenience on that device; phones always stack the panels.
 * The arrangements themselves are CSS (`.workspace` in globals.css), so the first paint is right.
 */

/** Three columns (chart, option chain, then order book and ticket), two (a wider chart, the rest beside it), or the chart on top. */
export type Arrangement = "three" | "two" | "stacked";

/**
 * The arrangements a trader can pick. Until they pick one, windows 85rem (1360px) and wider show
 * three columns and narrower ones two; three columns, picked, need 80rem (1280px). Those widths
 * live in globals.css.
 */
export const ARRANGEMENTS: readonly { id: Arrangement; label: string; note: string }[] = [
  { id: "three", label: "Three columns", note: "Chart, option chain, then the order book and ticket, on screens 1280px wide or more" },
  { id: "two", label: "Two columns", note: "A wider chart, with the chain, order book and ticket beside it" },
  { id: "stacked", label: "Chart on top", note: "The chart across the screen, the other panels below" },
];

/** The orders window's height under the chart, in CSS pixels. */
export const ORDERS_HEIGHT = { min: 140, max: 720, initial: 260 } as const;

export interface TradeLayout {
  /** Null until the trader picks one; the window's width decides meanwhile. */
  arrangement: Arrangement | null;
  /** The chart's side in the column arrangements. */
  chart: "left" | "right";
  /** The order book panel. */
  book: boolean;
  /** Positions, orders and trades. */
  orders: boolean;
  /** The rule meters in the account bar. */
  meters: boolean;
  ordersHeight: number;
}

export const DEFAULT_LAYOUT: TradeLayout = { arrangement: null, chart: "left", book: true, orders: true, meters: true, ordersHeight: ORDERS_HEIGHT.initial };

export const clampOrdersHeight = (height: number): number => Math.round(Math.min(ORDERS_HEIGHT.max, Math.max(ORDERS_HEIGHT.min, height)));

/** A saved layout, field by field: anything missing or malformed takes the default. */
export function parseLayout(saved: string | null): TradeLayout {
  let value: unknown = null;
  try {
    value = saved ? JSON.parse(saved) : null;
  } catch {
    value = null;
  }
  const record: Record<string, unknown> = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const flag = (key: "book" | "orders" | "meters") => (typeof record[key] === "boolean" ? record[key] : DEFAULT_LAYOUT[key]);
  const height = record.ordersHeight;
  return {
    arrangement: ARRANGEMENTS.find((item) => item.id === record.arrangement)?.id ?? null,
    chart: record.chart === "right" ? "right" : "left",
    book: flag("book"),
    orders: flag("orders"),
    meters: flag("meters"),
    ordersHeight: typeof height === "number" && Number.isFinite(height) ? clampOrdersHeight(height) : DEFAULT_LAYOUT.ordersHeight,
  };
}
