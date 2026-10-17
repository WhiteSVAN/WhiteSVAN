import { describe, expect, it } from "vitest";
import { ist } from "@/lib/trading/time";
import { candleStart, chartSeconds, foldTick, isInterval, type Candle, type LiveTick } from "./candles";

const tick = (at: string, price: number, dayVolume = 0, oi: number | null = null): LiveTick => ({ at: ist(at), price, dayVolume, oi });

describe("candle buckets", () => {
  it("counts intraday candles from the 09:15 open", () => {
    expect(candleStart(ist("2026-10-16 09:19:59"), "5minute")).toBe(ist("2026-10-16 09:15"));
    expect(candleStart(ist("2026-10-16 09:20"), "5minute")).toBe(ist("2026-10-16 09:20"));
    expect(candleStart(ist("2026-10-16 10:14:30"), "60minute")).toBe(ist("2026-10-16 09:15"));
    expect(candleStart(ist("2026-10-16 10:15"), "60minute")).toBe(ist("2026-10-16 10:15"));
    expect(candleStart(ist("2026-10-16 09:44"), "30minute")).toBe(ist("2026-10-16 09:15"));
    expect(candleStart(ist("2026-10-16 11:02:07"), "minute")).toBe(ist("2026-10-16 11:02"));
  });

  it("puts ticks outside market hours in the first or last candle", () => {
    expect(candleStart(ist("2026-10-16 09:07"), "5minute")).toBe(ist("2026-10-16 09:15"));
    expect(candleStart(ist("2026-10-16 15:30:04"), "5minute")).toBe(ist("2026-10-16 15:25"));
    expect(candleStart(ist("2026-10-16 15:45"), "60minute")).toBe(ist("2026-10-16 15:15"));
  });

  it("starts day candles at IST midnight", () => {
    expect(candleStart(ist("2026-10-16 15:29"), "day")).toBe(ist("2026-10-16 00:00"));
    expect(candleStart(ist("2026-10-16 00:10"), "day")).toBe(ist("2026-10-16 00:00"));
  });

  it("recognises Kite's interval names only", () => {
    expect(isInterval("15minute")).toBe(true);
    expect(isInterval("2minute")).toBe(false);
    expect(isInterval("week")).toBe(false);
  });
});

describe("folding live ticks into candles", () => {
  const last: Candle = { at: ist("2026-10-16 10:00"), open: 2_450_000, high: 2_451_000, low: 2_449_000, close: 2_450_500, volume: 1_200, oi: 900 };

  it("updates the newest candle and adds the volume traded since the last tick", () => {
    const previous = tick("2026-10-16 10:01:58", 2_450_500, 50_000, 900);
    const next = foldTick(last, tick("2026-10-16 10:02:01", 2_452_000, 50_300, 950), "5minute", previous);
    expect(next).toEqual({ ...last, high: 2_452_000, close: 2_452_000, volume: 1_500, oi: 950 });
    expect(foldTick(last, tick("2026-10-16 10:03", 2_448_000, 50_300), "5minute", previous)).toMatchObject({ low: 2_448_000, close: 2_448_000, high: 2_451_000, oi: 900 });
  });

  it("opens a new candle when the tick starts the next bucket", () => {
    const previous = tick("2026-10-16 10:04:59", 2_450_500, 50_000);
    expect(foldTick(last, tick("2026-10-16 10:05:01", 2_451_500, 50_075, 960), "5minute", previous)).toEqual({
      at: ist("2026-10-16 10:05"), open: 2_451_500, high: 2_451_500, low: 2_451_500, close: 2_451_500, volume: 75, oi: 960,
    });
  });

  it("ignores ticks older than the newest candle", () => {
    expect(foldTick(last, tick("2026-10-16 09:59", 2_440_000), "5minute", null)).toBeNull();
  });

  it("adds no volume without a same-day previous tick, and never negative volume", () => {
    expect(foldTick(last, tick("2026-10-16 10:02", 2_450_000, 70_000), "5minute", null)?.volume).toBe(1_200);
    expect(foldTick(last, tick("2026-10-16 10:02", 2_450_000, 70_000), "5minute", tick("2026-10-15 15:29", 1, 90_000))?.volume).toBe(1_200);
    expect(foldTick(last, tick("2026-10-16 10:02", 2_450_000, 10), "5minute", tick("2026-10-16 10:01", 1, 20))?.volume).toBe(1_200);
  });

  it("uses the day volume for day candles and starts the first candle from the tick", () => {
    const day: Candle = { ...last, at: ist("2026-10-16 00:00"), volume: 40_000 };
    expect(foldTick(day, tick("2026-10-16 14:00", 2_455_000, 61_000), "day", null)).toMatchObject({ volume: 61_000, close: 2_455_000, high: 2_455_000 });
    expect(foldTick(null, tick("2026-10-16 14:00", 2_455_000, 61_000), "minute", null)).toMatchObject({ at: ist("2026-10-16 14:00"), open: 2_455_000, volume: 0 });
  });
});

describe("chart time", () => {
  it("shifts epoch seconds so a UTC axis reads IST", () => {
    expect(new Date(chartSeconds(ist("2026-10-16 09:15")) * 1000).toISOString()).toBe("2026-10-16T09:15:00.000Z");
    expect(new Date(chartSeconds(ist("2026-10-16 00:00")) * 1000).toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });
});
