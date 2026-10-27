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
import type { AutoscaleInfo, CandlestickData, HistogramData, IChartApi, ISeriesApi, LineData, UTCTimestamp } from "lightweight-charts";
import { chartSeconds, type Candle, type Interval } from "@/lib/market-data/candles";
import type { ChartLine } from "@/lib/trading/desk";
import { onThemeChange } from "@/lib/theme";

/** Bars in view when a chart loads; scroll or pinch for the rest. */
const VISIBLE_BARS = 140;
/** Lightweight Charts' LineStyle.Dashed; the library loads lazily, so its enum isn't at hand. */
const DASHED = 2;

const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countText = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });

/** The chart's colours, from the theme tokens in globals.css; read again when the theme changes. */
interface Palette {
  up: string;
  down: string;
  upVolume: string;
  downVolume: string;
  grid: string;
  border: string;
  crosshair: string;
  label: string;
  text: string;
  mark: string;
  lines: Record<ChartLine["tone"], string>;
}

/** A hex token at the given opacity; any other colour as it is. */
function withAlpha(colour: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)?.[1];
  if (!hex) return colour;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const up = token("--chart-up");
  const down = token("--chart-down");
  const mark = token("--chart-mark");
  return {
    up,
    down,
    upVolume: withAlpha(up, 0.42),
    downVolume: withAlpha(down, 0.42),
    grid: token("--chart-grid"),
    border: token("--border"),
    crosshair: token("--border-strong"),
    label: token("--card-raised"),
    text: token("--muted"),
    mark,
    lines: { average: mark, stop: down, target: up, order: token("--muted") },
  };
}

const time = (at: number) => chartSeconds(at) as UTCTimestamp;
const toBar = (candle: Candle): CandlestickData<UTCTimestamp> => ({
  time: time(candle.at),
  open: candle.open / 100,
  high: candle.high / 100,
  low: candle.low / 100,
  close: candle.close / 100,
});
const toVolume = (palette: Palette) => (candle: Candle): HistogramData<UTCTimestamp> => ({
  time: time(candle.at),
  value: candle.volume,
  color: candle.close >= candle.open ? palette.upVolume : palette.downVolume,
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
  /** Prices to mark across the chart: a position's average, its stop-loss and target, working orders. */
  lines?: readonly ChartLine[];
}

export function PriceChart({ candles, live, interval, minMove, derivative, label, lines = [] }: PriceChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const [handles, setHandles] = useState<Handles | null>(null);
  const [hovered, setHovered] = useState<Legend | null>(null);
  const [palette, setPalette] = useState<Palette | null>(null);

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
          fontFamily: mono || "ui-monospace, monospace",
          fontSize: 11,
          attributionLogo: true,
        },
        timeScale: { rightOffset: 4, timeVisible: true, secondsVisible: false },
        crosshair: { mode: lib.CrosshairMode.Normal },
        localization: { locale: "en-IN" },
      });
      const count = { type: "custom" as const, minMove: 1, formatter: (value: number) => countText.format(value) };
      const candleSeries = chart.addSeries(lib.CandlestickSeries, {
        priceFormat: { type: "custom", minMove: 0.01, formatter: (value: number) => priceText.format(value) },
      });
      const volume = derivative ? chart.addSeries(lib.HistogramSeries, { priceFormat: count, priceLineVisible: false, lastValueVisible: false }, 1) : null;
      volume?.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });
      const oi = derivative ? chart.addSeries(lib.LineSeries, { lineWidth: 1, priceFormat: count, priceLineVisible: false }, 2) : null;
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
      setPalette(readPalette());
    });
    // The white and dark themes have their own chart colours.
    const stop = onThemeChange(() => setPalette(readPalette()));
    return () => {
      disposed = true;
      stop();
      created?.chart.remove();
    };
  }, [derivative]);

  useEffect(() => {
    if (!handles || !palette) return;
    const crosshairLine = { color: palette.crosshair, labelBackgroundColor: palette.label };
    handles.chart.applyOptions({
      layout: { textColor: palette.text, panes: { separatorColor: palette.border, separatorHoverColor: palette.grid } },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
      crosshair: { vertLine: crosshairLine, horzLine: crosshairLine },
    });
    handles.candles.applyOptions({ upColor: palette.up, downColor: palette.down, borderUpColor: palette.up, borderDownColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down });
    handles.oi?.applyOptions({ color: palette.mark });
  }, [handles, palette]);

  useEffect(() => {
    if (!handles || !palette) return;
    handles.candles.setData(candles.map(toBar));
    handles.volume?.setData(candles.map(toVolume(palette)));
    handles.oi?.setData(candles.flatMap(toOi));
    if (candles.length > 0) handles.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - VISIBLE_BARS), to: candles.length + 3 });
  }, [handles, palette, candles]);

  useEffect(() => {
    if (!handles || !palette || !live) return;
    try {
      handles.candles.update(toBar(live));
      handles.volume?.update(toVolume(palette)(live));
      for (const point of toOi(live)) handles.oi?.update(point);
    } catch {
      // A tick older than the newest bar (a stale poll after switching charts); the next one catches up.
    }
  }, [handles, palette, live]);

  // Compared by value: the lines are rebuilt on every poll, but only redrawn when they change.
  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    if (!handles || !palette) return;
    const marked = JSON.parse(linesKey) as ChartLine[];
    const prices = marked.map((line) => line.price / 100);
    const drawn = marked.map((line, index) => handles.candles.createPriceLine({ price: prices[index], color: palette.lines[line.tone], lineWidth: 1, lineStyle: DASHED, axisLabelVisible: true, title: line.title }));
    // The price scale stretches to keep every line in view, so a far stop-loss or target still shows.
    handles.candles.applyOptions({
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        if (!info?.priceRange || prices.length === 0) return info;
        return { ...info, priceRange: { minValue: Math.min(info.priceRange.minValue, ...prices), maxValue: Math.max(info.priceRange.maxValue, ...prices) } };
      },
    });
    return () => {
      for (const line of drawn) handles.candles.removePriceLine(line);
    };
  }, [handles, palette, linesKey]);

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
      {/* On laptops the chart takes what the screen leaves, so the orders window below it stays in view. */}
      <div ref={container} role="img" aria-label={`${label} candlestick chart`} data-lines={lines.map((line) => `${line.title} ${(line.price / 100).toFixed(2)}`).join("; ") || undefined} className={`w-full ${derivative ? "h-[360px] sm:h-[440px] lg:h-[clamp(300px,calc(100svh-33rem),540px)]" : "h-[300px] sm:h-[380px] lg:h-[clamp(280px,calc(100svh-33rem),520px)]"}`} />
      {legend && (
        <figcaption className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-6rem)] flex-wrap gap-x-3 gap-y-1 rounded bg-[var(--card)]/80 px-2 py-1 font-mono text-[10px] text-[var(--muted)] sm:text-[11px]">
          {(["open", "high", "low", "close"] as const).map((field) => (
            <span key={field}>{field[0].toUpperCase()} <span className={legend.close >= legend.open ? "text-[var(--primary)]" : "text-[var(--danger)]"}>{priceText.format(legend[field])}</span></span>
          ))}
          {legend.volume !== null && legend.volume > 0 && <span>Vol <span className="text-[var(--foreground)]">{countText.format(legend.volume)}</span></span>}
          {derivative && legend.oi !== null && <span>OI <span className="text-[var(--chart-mark)]">{countText.format(legend.oi)}</span></span>}
        </figcaption>
      )}
    </figure>
  );
}
