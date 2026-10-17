"use client";

/*
 * Candlestick chart, with volume and open-interest panes for futures and options, for candles from
 * any data source.
 *
 * TradingView Lightweight Charts™
 * Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/ (Apache-2.0)
 * The chart keeps TradingView's attribution logo, which meets the licence's link requirement.
 */
import { useEffect, useRef, useState } from "react";
import type { CandlestickData, HistogramData, IChartApi, ISeriesApi, LineData, UTCTimestamp } from "lightweight-charts";
import { chartSeconds, type Candle, type Interval } from "@/lib/market-data/candles";

const UP = "#baf277";
const DOWN = "#f2907e";
const GRID = "rgba(40, 50, 43, 0.55)";
const BORDER = "#28322b";
/** Bars in view when a chart loads; scroll or pinch for the rest. */
const VISIBLE_BARS = 140;

const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countText = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });

const time = (at: number) => chartSeconds(at) as UTCTimestamp;
const toBar = (candle: Candle): CandlestickData<UTCTimestamp> => ({
  time: time(candle.at),
  open: candle.open / 100,
  high: candle.high / 100,
  low: candle.low / 100,
  close: candle.close / 100,
});
const toVolume = (candle: Candle): HistogramData<UTCTimestamp> => ({
  time: time(candle.at),
  value: candle.volume,
  color: candle.close >= candle.open ? "rgba(186, 242, 119, 0.42)" : "rgba(242, 144, 126, 0.42)",
});
const toOi = (candle: Candle): LineData<UTCTimestamp>[] => (candle.oi === null ? [] : [{ time: time(candle.at), value: candle.oi }]);

interface Handles {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram"> | null;
  oi: ISeriesApi<"Line"> | null;
}

/** What the legend shows: the bar under the crosshair, or the newest bar. */
interface Legend {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  oi: number | null;
}

export interface PriceChartProps {
  /** History, oldest first. A new array replaces the chart's data. */
  candles: readonly Candle[];
  /** The newest candle as live prices arrive; must not be older than the last history candle. */
  live: Candle | null;
  interval: Interval;
  /** Smallest price step in rupees, such as 0.05. */
  minMove: number;
  /** Adds volume and open-interest panes (futures and options). Fixed for the chart's lifetime. */
  derivative: boolean;
  /** Accessible name, such as "NIFTY 26 OCT FUT, 5-minute candles". */
  label: string;
}

export function PriceChart({ candles, live, interval, minMove, derivative, label }: PriceChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const [handles, setHandles] = useState<Handles | null>(null);
  const [hovered, setHovered] = useState<Legend | null>(null);

  useEffect(() => {
    let created: Handles | null = null;
    let disposed = false;
    import("lightweight-charts").then((lib) => {
      const element = container.current;
      if (disposed || !element) return;
      const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-terminal-mono").trim();
      const chart = lib.createChart(element, {
        autoSize: true,
        layout: {
          background: { type: lib.ColorType.Solid, color: "transparent" },
          textColor: "#99a59c",
          fontFamily: mono || "ui-monospace, monospace",
          fontSize: 11,
          attributionLogo: true,
          panes: { separatorColor: BORDER, separatorHoverColor: "rgba(186, 242, 119, 0.08)" },
        },
        grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
        rightPriceScale: { borderColor: BORDER },
        timeScale: { borderColor: BORDER, rightOffset: 4, timeVisible: true, secondsVisible: false },
        crosshair: {
          mode: lib.CrosshairMode.Normal,
          vertLine: { color: "#3a493d", labelBackgroundColor: "#172018" },
          horzLine: { color: "#3a493d", labelBackgroundColor: "#172018" },
        },
        localization: { locale: "en-IN" },
      });
      const count = { type: "custom" as const, minMove: 1, formatter: (value: number) => countText.format(value) };
      const candleSeries = chart.addSeries(lib.CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        priceFormat: { type: "custom", minMove: 0.01, formatter: (value: number) => priceText.format(value) },
      });
      const volume = derivative ? chart.addSeries(lib.HistogramSeries, { priceFormat: count, priceLineVisible: false, lastValueVisible: false }, 1) : null;
      volume?.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });
      const oi = derivative ? chart.addSeries(lib.LineSeries, { color: "#d8c899", lineWidth: 1, priceFormat: count, priceLineVisible: false }, 2) : null;
      chart.panes().forEach((pane, index) => pane.setStretchFactor(index === 0 ? 1 : 0.24));

      chart.subscribeCrosshairMove((param) => {
        const bar = param.time ? (param.seriesData.get(candleSeries) as CandlestickData | undefined) : undefined;
        if (!bar || bar.open === undefined) return setHovered(null);
        const traded = volume ? (param.seriesData.get(volume) as HistogramData | undefined) : undefined;
        const interest = oi ? (param.seriesData.get(oi) as LineData | undefined) : undefined;
        setHovered({ open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: traded?.value ?? null, oi: interest?.value ?? null });
      });
      created = { chart, candles: candleSeries, volume, oi };
      setHandles(created);
    });
    return () => {
      disposed = true;
      created?.chart.remove();
    };
  }, [derivative]);

  useEffect(() => {
    if (!handles) return;
    handles.candles.setData(candles.map(toBar));
    handles.volume?.setData(candles.map(toVolume));
    handles.oi?.setData(candles.flatMap(toOi));
    if (candles.length > 0) handles.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - VISIBLE_BARS), to: candles.length + 3 });
  }, [handles, candles]);

  useEffect(() => {
    if (!handles || !live) return;
    try {
      handles.candles.update(toBar(live));
      handles.volume?.update(toVolume(live));
      for (const point of toOi(live)) handles.oi?.update(point);
    } catch {
      // A tick older than the newest bar (a stale poll after switching charts); the next one catches up.
    }
  }, [handles, live]);

  useEffect(() => {
    if (!handles) return;
    handles.chart.applyOptions({ timeScale: { timeVisible: interval !== "day" } });
    handles.candles.applyOptions({ priceFormat: { type: "custom", minMove, formatter: (value: number) => priceText.format(value) } });
  }, [handles, interval, minMove]);

  const newest = live ?? candles[candles.length - 1] ?? null;
  const legend: Legend | null = hovered ?? (newest && {
    open: newest.open / 100,
    high: newest.high / 100,
    low: newest.low / 100,
    close: newest.close / 100,
    volume: newest.volume,
    oi: newest.oi,
  });

  return (
    <figure className="relative m-0">
      <div ref={container} role="img" aria-label={`${label} candlestick chart`} className={`w-full ${derivative ? "h-[380px] sm:h-[500px]" : "h-[320px] sm:h-[420px]"}`} />
      {legend && (
        <figcaption className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-6rem)] flex-wrap gap-x-3 gap-y-1 rounded bg-[#0b0f0d]/80 px-2 py-1 font-mono text-[10px] text-[var(--muted)] sm:text-[11px]">
          {(["open", "high", "low", "close"] as const).map((field) => (
            <span key={field}>{field[0].toUpperCase()} <span className={legend.close >= legend.open ? "text-[var(--primary)]" : "text-[var(--danger)]"}>{priceText.format(legend[field])}</span></span>
          ))}
          {legend.volume !== null && legend.volume > 0 && <span>Vol <span className="text-[var(--foreground)]">{countText.format(legend.volume)}</span></span>}
          {derivative && legend.oi !== null && <span>OI <span className="text-[#d8c899]">{countText.format(legend.oi)}</span></span>}
        </figcaption>
      )}
    </figure>
  );
}
