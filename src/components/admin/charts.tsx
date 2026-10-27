"use client";

/**
 * The admin portal's two charts, in plain SVG on the theme tokens: daily P&L as bars around zero
 * (gains up in --chart-gain, losses down in --chart-loss: position carries the sign as well as
 * colour), and the closing balance against the drawdown floor. Hover or focus and use the arrow keys
 * to read a day; every value is also in the table beside the chart.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const PLOT_HEIGHT = 200;
const AXIS_BAND = 26;
const LEFT = 56;
const RIGHT = 16;
const TOP = 12;

/** Rupees from paise, compact for axis ticks: ₹1.2L, ₹15K, −₹500. */
function compact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? "−" : "";
  const fixed = (value: number) => (value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, ""));
  if (rupees >= 1e7) return `${sign}₹${fixed(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `${sign}₹${fixed(rupees / 1e5)}L`;
  if (rupees >= 1e3) return `${sign}₹${fixed(rupees / 1e3)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

const full = (paise: number) => `${paise < 0 ? "−" : ""}${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.abs(paise) / 100)}`;
const day = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** Round tick values from at or below `min` to at or above `max`, about four steps apart. */
function ticks(min: number, max: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const rough = span / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power;
  const out: number[] = [];
  for (let value = Math.floor(min / step) * step; out.length < 12; value += step) {
    out.push(Math.round(value));
    if (value >= max) break;
  }
  return out;
}

/** The container's width, measured after mount (SSR renders at the default). */
function useWidth(initial = 720) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Pointer and arrow-key reading of one point at a time. */
function useReader(count: number, xOf: (index: number) => number) {
  const [index, setIndex] = useState<number | null>(null);
  const nearest = (x: number) => {
    let best = 0;
    for (let candidate = 1; candidate < count; candidate++) if (Math.abs(xOf(candidate) - x) < Math.abs(xOf(best) - x)) best = candidate;
    return best;
  };
  return {
    index,
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      if (count) setIndex(nearest(event.clientX - box.left));
    },
    onPointerLeave: () => setIndex(null),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!count) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(0, Math.min(count - 1, (current ?? (event.key === "ArrowRight" ? -1 : count)) + (event.key === "ArrowRight" ? 1 : -1))));
      } else if (event.key === "Escape") setIndex(null);
    },
    onBlur: () => setIndex(null),
  };
}

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x, 80), width - 80);
  return (
    <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-[var(--shadow-card)]" style={{ left }}>
      {children}
    </div>
  );
}

/** A bar from the zero line to `value`, its far end rounded (4px) and its base square. */
function barPath(x: number, width: number, zero: number, end: number): string {
  const height = Math.abs(end - zero);
  const r = Math.min(4, width / 2, height);
  if (height < 0.5) return "";
  if (end < zero) {
    // Up from the baseline: round the top.
    return `M${x},${zero} V${end + r} Q${x},${end} ${x + r},${end} H${x + width - r} Q${x + width},${end} ${x + width},${end + r} V${zero} Z`;
  }
  return `M${x},${zero} V${end - r} Q${x},${end} ${x + r},${end} H${x + width - r} Q${x + width},${end} ${x + width},${end - r} V${zero} Z`;
}

export function PnlBars({ days, label }: { days: readonly { date: string; net: number }[]; label: string }) {
  const { ref, width } = useWidth();
  const plotWidth = width - LEFT - RIGHT;
  const values = days.map((item) => item.net);
  const axis = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const low = axis[0];
  const high = axis[axis.length - 1];
  const y = (value: number) => TOP + ((high - value) / (high - low || 1)) * PLOT_HEIGHT;
  const band = days.length ? plotWidth / days.length : plotWidth;
  const barWidth = Math.max(2, Math.min(24, band * 0.7));
  const xOf = (index: number) => LEFT + band * index + band / 2;
  const reader = useReader(days.length, xOf);
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotWidth / 72))));
  const active = reader.index === null ? null : days[reader.index];
  if (!days.length) return <p className="py-10 text-center text-sm text-[var(--muted)]">No closed trading days yet.</p>;
  return (
    <div ref={ref} className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" tabIndex={0} role="img" aria-label={`${label}: ${days.length} days, use the arrow keys to read each day`} onKeyDown={reader.onKeyDown} onBlur={reader.onBlur}>
      <svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND} onPointerMove={reader.onPointerMove} onPointerLeave={reader.onPointerLeave} className="block touch-none select-none">
        {axis.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={width - RIGHT} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={LEFT - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="tabular-figures fill-[var(--muted)] text-[10px]">{compact(tick)}</text>
          </g>
        ))}
        <line x1={LEFT} x2={width - RIGHT} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
        {days.map((item, index) => (
          <path key={item.date} d={barPath(xOf(index) - barWidth / 2, barWidth, y(0), y(item.net))} fill={item.net >= 0 ? "var(--chart-gain)" : "var(--chart-loss)"} opacity={reader.index === null || reader.index === index ? 1 : 0.45} />
        ))}
        {days.map((item, index) => (index % every === 0 || index === days.length - 1) && (
          <text key={item.date} x={xOf(index)} y={TOP + PLOT_HEIGHT + 17} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">{day(item.date)}</text>
        ))}
      </svg>
      {active && reader.index !== null && (
        <Tooltip x={xOf(reader.index)} width={width}>
          <p className="tabular-figures text-sm font-semibold">{full(active.net)}</p>
          <p className="mt-0.5 text-[var(--muted)]">{day(active.date)}</p>
        </Tooltip>
      )}
    </div>
  );
}

export function BalanceLine({ points, label }: { points: readonly { date: string; closing: number; floor: number }[]; label: string }) {
  const { ref, width } = useWidth();
  const plotWidth = width - LEFT - RIGHT - 84;
  const values = points.length ? points.flatMap((point) => [point.closing, point.floor]) : [0];
  const axis = ticks(Math.min(...values), Math.max(...values));
  const low = axis[0];
  const high = axis[axis.length - 1];
  const y = (value: number) => TOP + ((high - value) / (high - low || 1)) * PLOT_HEIGHT;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xOf = (index: number) => LEFT + step * index;
  const reader = useReader(points.length, xOf);
  const line = (key: "closing" | "floor") => points.map((point, index) => `${index ? "L" : "M"}${xOf(index)},${y(point[key])}`).join(" ");
  const last = points[points.length - 1];
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 72))));
  const active = reader.index === null ? null : points[reader.index];
  if (points.length < 2) return <p className="py-10 text-center text-sm text-[var(--muted)]">The balance chart starts after the first closed day.</p>;
  return (
    <div ref={ref} className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" tabIndex={0} role="img" aria-label={`${label}: closing balance and drawdown floor, use the arrow keys to read each day`} onKeyDown={reader.onKeyDown} onBlur={reader.onBlur}>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--chart-line)]" aria-hidden="true" /> Closing balance</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--faint)]" aria-hidden="true" /> Drawdown floor</span>
      </div>
      <svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND} onPointerMove={reader.onPointerMove} onPointerLeave={reader.onPointerLeave} className="block touch-none select-none">
        {axis.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={LEFT + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={LEFT - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="tabular-figures fill-[var(--muted)] text-[10px]">{compact(tick)}</text>
          </g>
        ))}
        <path d={line("floor")} fill="none" stroke="var(--faint)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("closing")} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <text x={xOf(points.length - 1) + 8} y={y(last.closing)} dy="0.32em" className="tabular-figures fill-[var(--foreground)] text-[11px] font-medium">{compact(last.closing)}</text>
        <text x={xOf(points.length - 1) + 8} y={y(last.floor)} dy="0.32em" className="tabular-figures fill-[var(--muted)] text-[11px]">Floor {compact(last.floor)}</text>
        {points.map((point, index) => (index % every === 0 || index === points.length - 1) && (
          <text key={point.date} x={xOf(index)} y={TOP + PLOT_HEIGHT + 17} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">{point.date === "start" ? "Start" : day(point.date)}</text>
        ))}
        {reader.index !== null && active && (
          <g>
            <line x1={xOf(reader.index)} x2={xOf(reader.index)} y1={TOP} y2={TOP + PLOT_HEIGHT} stroke="var(--border-strong)" strokeWidth={1} />
            <circle cx={xOf(reader.index)} cy={y(active.closing)} r={4} fill="var(--chart-line)" stroke="var(--card)" strokeWidth={2} />
            <circle cx={xOf(reader.index)} cy={y(active.floor)} r={4} fill="var(--faint)" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {active && reader.index !== null && (
        <Tooltip x={xOf(reader.index)} width={width}>
          <p className="text-[var(--muted)]">{active.date === "start" ? "Start" : day(active.date)}</p>
          <p className="mt-1 flex items-center gap-2"><span className="h-0.5 w-3 rounded-full bg-[var(--chart-line)]" aria-hidden="true" /><span className="tabular-figures font-semibold">{full(active.closing)}</span><span className="text-[var(--muted)]">balance</span></p>
          <p className="mt-0.5 flex items-center gap-2"><span className="h-0.5 w-3 rounded-full bg-[var(--faint)]" aria-hidden="true" /><span className="tabular-figures font-semibold">{full(active.floor)}</span><span className="text-[var(--muted)]">floor</span></p>
        </Tooltip>
      )}
    </div>
  );
}
