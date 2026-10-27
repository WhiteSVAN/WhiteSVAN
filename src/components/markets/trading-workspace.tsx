"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { GripHorizontal, LayoutGrid, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { ARRANGEMENTS, clampOrdersHeight, DEFAULT_LAYOUT, ORDERS_HEIGHT, parseLayout, type Arrangement, type TradeLayout } from "@/lib/trade-layout";

const STORAGE_KEY = "whitesvan.trade-layout.v1";
const CHANGE_EVENT = "whitesvan:trade-layout";
let lastSaved: string | null | undefined;
let snapshot = DEFAULT_LAYOUT;
let memoryOnly = false;

function readLayout(): TradeLayout {
  if (memoryOnly) return snapshot;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== lastSaved) { snapshot = parseLayout(saved); lastSaved = saved; }
  } catch { memoryOnly = true; }
  return snapshot;
}

function saveLayout(next: TradeLayout) {
  snapshot = next;
  lastSaved = JSON.stringify(next);
  try { localStorage.setItem(STORAGE_KEY, lastSaved); } catch { memoryOnly = true; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", storage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(CHANGE_EVENT, onChange); };
}
const serverLayout = () => DEFAULT_LAYOUT;

/** A thumbnail of an arrangement: the chart darker, then the orders window, the chain, and the order book with the ticket. */
function Thumbnail({ arrangement, right }: { arrangement: Arrangement | null; right: boolean }) {
  const boxes: [number, number, number, number, boolean][] = arrangement === "stacked"
    ? [[1, 1, 46, 15, true], [1, 18, 13, 13, false], [16, 18, 12, 13, false], [30, 18, 17, 13, false]]
    : arrangement === "two"
      ? [[1, 1, 31, 20, true], [1, 23, 31, 8, false], [34, 1, 13, 30, false]]
      : [[1, 1, 23, 20, true], [1, 23, 23, 8, false], [26, 1, 10, 30, false], [38, 1, 9, 30, false]];
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" className="h-8 w-12 shrink-0">
      <g transform={right && arrangement !== "stacked" ? "translate(48 0) scale(-1 1)" : undefined}>
        {boxes.map(([x, y, width, height, chart], index) => <rect key={index} x={x} y={y} width={width} height={height} rx={1.5} fill="currentColor" opacity={chart ? 0.75 : 0.3} />)}
      </g>
    </svg>
  );
}

/** The layout menu: the arrangement, the chart's side and the optional panels, saved in this browser. */
function LayoutMenu({ layout, patch, hasOrders, hasMeters, onReset }: { layout: TradeLayout; patch: (change: Partial<TradeLayout>) => void; hasOrders: boolean; hasMeters: boolean; onReset: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const sideLabel = useId();
  const stacked = layout.arrangement === "stacked";

  // Close on Escape or a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (focus: boolean) => {
      if (!menu.current) return;
      menu.current.open = false;
      if (focus) menu.current.querySelector("summary")?.focus();
    };
    const away = (event: globalThis.PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  const choices: { id: Arrangement | null; label: string; note: string }[] = [
    { id: null, label: "Automatic", note: "Three columns on wide screens, two on smaller ones" },
    ...ARRANGEMENTS,
  ];
  const option = "flex cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--primary)]";
  return (
    <details ref={menu} onToggle={(event) => setOpen(event.currentTarget.open)} className="relative hidden lg:block">
      <summary className="flex min-h-9 list-none items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-3 text-xs hover:bg-[var(--card-raised)] [&::-webkit-details-marker]:hidden">
        <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Layout
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-[22rem] space-y-4 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-4 text-sm shadow-xl">
        <fieldset>
          <legend className="terminal-label">Arrangement</legend>
          <div className="mt-2 space-y-1.5">
            {choices.map((choice) => {
              const chosen = layout.arrangement === choice.id;
              return (
                <label key={choice.id ?? "auto"} className={`${option} ${chosen ? "border-[var(--primary)] bg-[var(--card-raised)]" : "border-[var(--border)] hover:bg-[var(--card-raised)]"}`}>
                  <input type="radio" name="workspace-arrangement" checked={chosen} onChange={() => patch({ arrangement: choice.id })} className="sr-only" />
                  <span className={chosen ? "text-[var(--primary)]" : "text-[var(--muted)]"}><Thumbnail arrangement={choice.id} right={layout.chart === "right"} /></span>
                  <span className="min-w-0 text-xs"><span className="block font-medium">{choice.label}</span><span className="block leading-4 text-[var(--muted)]">{choice.note}</span></span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className={`flex items-center justify-between gap-3 ${stacked ? "opacity-50" : ""}`}>
          <span id={sideLabel} className="text-xs">Chart side{stacked && <span className="text-[var(--muted)]"> (column layouts)</span>}</span>
          <div role="radiogroup" aria-labelledby={sideLabel} className="flex rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-0.5">
            {(["left", "right"] as const).map((side) => (
              <label key={side} className={`rounded-md px-3 py-1 text-xs capitalize has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--primary)] ${stacked ? "" : "cursor-pointer"} ${layout.chart === side ? "bg-[var(--ink)] text-[var(--ink-foreground)]" : "text-[var(--muted)]"}`}>
                <input type="radio" name="workspace-chart-side" disabled={stacked} checked={layout.chart === side} onChange={() => patch({ chart: side })} className="sr-only" />{side}
              </label>
            ))}
          </div>
        </div>
        <fieldset className="space-y-2 border-t border-[var(--border)] pt-3 text-xs">
          <legend className="sr-only">Panels</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={layout.book} onChange={(event) => patch({ book: event.target.checked })} /> Order book</label>
          {hasOrders && <label className="flex items-center gap-2"><input type="checkbox" checked={layout.orders} onChange={(event) => patch({ orders: event.target.checked })} /> Positions, orders and trades</label>}
          {hasMeters && <label className="flex items-center gap-2"><input type="checkbox" checked={layout.meters} onChange={(event) => patch({ meters: event.target.checked })} /> Rule meters</label>}
        </fieldset>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <p className="text-[11px] leading-4 text-[var(--muted)]">Saved in this browser. Phones stack the panels.</p>
          <button type="button" onClick={onReset} className="inline-flex shrink-0 items-center gap-1.5 text-xs underline"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset</button>
        </div>
      </div>
    </details>
  );
}

/**
 * The trading platform's workspace, arranged as the trader picks (src/lib/trade-layout.ts, and
 * `.workspace` in globals.css): the account bar (`header`, `toolbar` and `metrics`, with Expand
 * and the layout menu), then the chart with the orders window under it, the option chain, and the
 * order book with the ticket. Panels stay mounted when rearranged, so the chart's view, the
 * ticket's draft and the blotter's tab survive a change.
 */
export function TradingWorkspace({ header, toolbar, metrics, chart, chain, book, ticket, orders }: {
  header?: ReactNode; toolbar?: ReactNode; metrics?: ReactNode; chart: ReactNode; chain: ReactNode;
  book: ReactNode; ticket: ReactNode; orders?: ReactNode;
}) {
  const layout = useSyncExternalStore(subscribe, readLayout, serverLayout);
  const [expanded, setExpanded] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const ordersPanel = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const patch = (change: Partial<TradeLayout>) => saveLayout({ ...readLayout(), ...change });

  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    // The workspace fills the window below wherever it starts, notices and all.
    const measure = () => element.style.setProperty("--workspace-top", `${Math.ceil(element.getBoundingClientRect().top + window.scrollY)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(document.querySelector("main") ?? element);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExpanded(false);
      expandButton.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded]);

  const resize = (height: number) => {
    // Keep a useful chart even when a saved tall orders window meets a smaller window.
    const available = Math.max(ORDERS_HEIGHT.min, (main.current?.clientHeight ?? 800) - 332);
    patch({ ordersHeight: Math.min(clampOrdersHeight(height), available) });
  };
  const beginResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { y: event.clientY, height: ordersPanel.current?.getBoundingClientRect().height ?? layout.ordersHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section ref={workspace} data-workspace data-arrangement={layout.arrangement ?? "auto"} data-chart={layout.chart} data-orders={orders && layout.orders ? "on" : "off"} data-meters={layout.meters ? "on" : "off"} data-expanded={expanded || undefined}
      className="workspace flex min-w-0 flex-col gap-3" style={{ "--orders-height": `${layout.ordersHeight}px` } as CSSProperties} aria-label="Trading workspace">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
        {header}
        {toolbar}
        {metrics}
        <div className="ml-auto flex items-center gap-2">
          {/* The words show once three columns do; narrower screens keep the bar to one row with the icon. */}
          <button ref={expandButton} type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Restore panels" : "Expand chart"} title={expanded ? "Restore panels" : "Expand chart"}
            className="hidden min-h-9 items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 text-xs hover:bg-[var(--card-raised)] lg:inline-flex">
            {expanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}<span className="hidden min-[85rem]:inline" aria-hidden="true">{expanded ? "Restore panels" : "Expand chart"}</span>
          </button>
          <LayoutMenu layout={layout} patch={patch} hasOrders={Boolean(orders)} hasMeters={Boolean(metrics)} onReset={() => { saveLayout(DEFAULT_LAYOUT); setExpanded(false); }} />
        </div>
      </div>
      <div className="workspace-grid grid min-w-0 gap-3">
        <div ref={main} className="ws-main min-w-0 space-y-3 lg:space-y-0">
          <div className="ws-chart min-w-0">{chart}</div>
          {orders && <>
            <div role="separator" aria-label="Resize the orders window" aria-orientation="horizontal" aria-valuemin={ORDERS_HEIGHT.min} aria-valuemax={ORDERS_HEIGHT.max} aria-valuenow={layout.ordersHeight} tabIndex={layout.orders ? 0 : -1}
              className="ws-splitter hidden h-3 shrink-0 touch-none cursor-row-resize items-center justify-center text-[var(--faint)] hover:text-[var(--foreground)] lg:flex"
              onPointerDown={beginResize} onPointerMove={(event) => { if (drag.current) resize(drag.current.height + drag.current.y - event.clientY); }} onPointerUp={stopResize} onPointerCancel={stopResize}
              onKeyDown={(event) => {
                const current = ordersPanel.current?.getBoundingClientRect().height ?? layout.ordersHeight;
                if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  resize(event.key === "Home" ? ORDERS_HEIGHT.min : event.key === "End" ? ORDERS_HEIGHT.max : current + (event.key === "ArrowUp" ? 20 : -20));
                }
              }}><GripHorizontal className="h-4 w-5" aria-hidden="true" /></div>
            <div ref={ordersPanel} className="ws-orders min-w-0" hidden={!layout.orders}>{orders}</div>
          </>}
        </div>
        <div className="ws-right min-w-0 space-y-3 lg:space-y-0">
          <div className="ws-chain min-w-0">{chain}</div>
          <div className="ws-side min-w-0 space-y-3"><div hidden={!layout.book}>{book}</div>{ticket}</div>
        </div>
      </div>
    </section>
  );
}
