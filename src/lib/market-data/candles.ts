/**
 * Candles for price charts, whatever the data source: Zerodha Kite for the firm's own account
 * today, a licensed exchange feed for traders later. Prices are integer paise like the trading
 * core; times are UTC epoch milliseconds, bucketed on the IST trading day. Pure: callers pass
 * every timestamp in.
 */
import type { Paise } from "@/lib/trading/money";
import { clockSeconds, istInstant, toIst } from "@/lib/trading/time";

/** Kite's candle intervals, shortest first. */
export const INTERVALS = ["minute", "3minute", "5minute", "10minute", "15minute", "30minute", "60minute", "day"] as const;
export type Interval = (typeof INTERVALS)[number];

const INTERVAL_SECONDS: Record<Interval, number> = {
  minute: 60,
  "3minute": 180,
  "5minute": 300,
  "10minute": 600,
  "15minute": 900,
  "30minute": 1_800,
  "60minute": 3_600,
  day: 86_400,
};

export const isInterval = (value: string): value is Interval => (INTERVALS as readonly string[]).includes(value);

/** Calendar days of history a chart loads for each interval. */
export const LOOKBACK_DAYS: Record<Interval, number> = {
  minute: 7,
  "3minute": 14,
  "5minute": 21,
  "10minute": 30,
  "15minute": 45,
  "30minute": 90,
  "60minute": 180,
  day: 730,
};

export interface Candle {
  /** Start of the candle, UTC epoch milliseconds. Day candles start at IST midnight. */
  at: number;
  open: Paise;
  high: Paise;
  low: Paise;
  close: Paise;
  /** Units traded in the candle; 0 for an index. */
  volume: number;
  /** Open interest at the candle's close; null for an index or when not requested. */
  oi: number | null;
}

/**
 * Intraday candles count from the 09:15 IST open, as the exchanges' bars do (an hourly candle runs
 * 09:15–10:15). Ticks before the open join the first candle; ticks from 15:30 on join the last.
 */
export const SESSION = { open: "09:15", close: "15:30" } as const;

export function candleStart(at: number, interval: Interval): number {
  const { date, second } = toIst(at);
  if (interval === "day") return istInstant(date, 0);
  const open = clockSeconds(SESSION.open);
  const offset = Math.min(Math.max(second, open), clockSeconds(SESSION.close) - 1) - open;
  const size = INTERVAL_SECONDS[interval];
  return istInstant(date, open + Math.floor(offset / size) * size);
}

/** A live price for one instrument, as a quote poll or a feed tick delivers it. */
export interface LiveTick {
  /** When the price last traded (or the index last moved), UTC epoch milliseconds. */
  at: number;
  price: Paise;
  /** Units traded so far today. */
  dayVolume: number;
  oi: number | null;
}

/**
 * Fold a live tick into the chart's newest candle. Returns that candle updated when the tick falls
 * inside it, a new candle when the tick opens the next one, or null for a tick older than the
 * newest candle. Intraday volume grows by the change in day volume since `previous` (the last tick
 * folded in, if it was on the same IST day); a day candle's volume is the day volume.
 */
export function foldTick(last: Candle | null, tick: LiveTick, interval: Interval, previous: LiveTick | null): Candle | null {
  const at = candleStart(tick.at, interval);
  if (last && at < last.at) return null;
  const sameDay = previous !== null && toIst(previous.at).date === toIst(tick.at).date;
  const traded = sameDay ? Math.max(0, tick.dayVolume - previous.dayVolume) : 0;
  if (last && at === last.at) {
    return {
      at,
      open: last.open,
      high: Math.max(last.high, tick.price),
      low: Math.min(last.low, tick.price),
      close: tick.price,
      volume: interval === "day" ? tick.dayVolume : last.volume + traded,
      oi: tick.oi ?? last.oi,
    };
  }
  return {
    at,
    open: tick.price,
    high: tick.price,
    low: tick.price,
    close: tick.price,
    volume: interval === "day" ? tick.dayVolume : traded,
    oi: tick.oi,
  };
}

/**
 * Chart time for a candle: epoch seconds shifted by +05:30. The chart library labels its axis in
 * UTC, so the shift makes it show IST wall-clock times and IST dates (India has no daylight saving).
 */
export const IST_OFFSET_SECONDS = 19_800;
export const chartSeconds = (at: number) => Math.floor(at / 1000) + IST_OFFSET_SECONDS;
