"use client";

/*
 * Trading on the chart, over TradingView Lightweight Charts™: a label on each of the position's lines
 * (its average, stop-loss and target) and on every working order. Drag a stop-loss, target or order
 * to move it, or focus its label and use the arrow keys and Enter; × cancels it, or closes the
 * position. SL and TP on the position add them: drag one out, or click it and then the chart. A
 * right-click, or the + by the price scale, offers orders at that price.
 */
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent, type RefObject } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import { Plus, X } from "lucide-react";
import type { ChartLine } from "@/lib/trading/desk";

/** An order the chart's menu offers at a price. Resolves to an error to show, or null. */
export interface ChartAction {
  label: string;
  run(): Promise<string | null>;
}

/** What the chart can do on the account. Prices in paise; each call resolves to an error to show, or null. */
export interface ChartTrading {
  /** The orders the menu offers at a price. */
  actions(price: number): ChartAction[];
  /** Move a stop-loss, target or working order to a price. */
  move(line: ChartLine, price: number): Promise<string | null>;
  /** Cancel a line's order; on the average line, close the position. */
  cancel(line: ChartLine): Promise<string | null>;
  /** Add the position's stop-loss or target. */
  addExit(role: Role, price: number): Promise<string | null>;
}

type Role = "stop" | "target";

/** A line's key: its order's id, or the tone for the position's average. */
export const lineKey = (line: ChartLine) => line.orderId ?? line.tone;

/** Lightweight Charts' LineStyle.Dotted, for a line not yet placed. */
const DOTTED = 1;
/** Pixels a press must travel before it counts as a drag. */
const DRAG_SLOP = 3;
const ERROR_MS = 5_000;

const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupees = (paise: number) => `₹${priceText.format(paise / 100)}`;
const signed = (paise: number) => `${paise > 0 ? "+" : paise < 0 ? "−" : ""}₹${whole.format(Math.abs(paise) / 100)}`;
const pnlTone = (paise: number) => (paise > 0 ? "text-[var(--primary)]" : paise < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]");

const TONE: Record<ChartLine["tone"], string> = {
  average: "border-[var(--chart-mark)]",
  stop: "border-[var(--chart-down)]",
  target: "border-[var(--chart-up)]",
  order: "border-[var(--border-strong)]",
};
const TITLE: Record<ChartLine["tone"], string> = { average: "text-[var(--chart-mark)]", stop: "text-[var(--chart-down)]", target: "text-[var(--chart-up)]", order: "text-[var(--muted)]" };
const ROLE_TITLE: Record<Role, string> = { stop: "SL", target: "TP" };
const ROLE_NAME: Record<Role, string> = { stop: "stop-loss", target: "target" };

/** The menu of orders at a price, anchored by the corner nearest the point it opened at. */
interface Menu {
  price: number;
  actions: ChartAction[];
  place: { left?: number; right?: number; top?: number; bottom?: number };
}

/** A press on a line's label or on SL or TP: a drag once it travels, otherwise a click. */
interface Press {
  pointerId: number;
  startY: number;
  /** The line being moved, or the exit being added. */
  target: { line: ChartLine } | { role: Role };
  price: number;
  moved: boolean;
}

export interface ChartOrdersProps {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  /** The price lines the chart drew, by lineKey; a drag moves them as the pointer goes. */
  drawn: RefObject<Map<string, IPriceLine>>;
  lines: readonly ChartLine[];
  colors: Record<ChartLine["tone"], string>;
  /** Prices sent to the account and not yet answered, by lineKey. */
  pending: Readonly<Record<string, number>>;
  onPending: (key: string, price: number | null) => void;
  /** Price step in paise. */
  tick: number;
  /** The last price in paise. */
  last: number | null;
  trading: ChartTrading;
}

export function ChartOrders({ chart, series, drawn, lines, colors, pending, onPending, tick, last, trading }: ChartOrdersProps) {
  const chips = useRef(new Map<string, HTMLElement>());
  const plus = useRef<HTMLButtonElement>(null);
  const plusPrice = useRef<number | null>(null);
  const overPlus = useRef(false);
  const press = useRef<Press | null>(null);
  /** The dotted line of an exit being added. */
  const draft = useRef<IPriceLine | null>(null);
  /** A line moved by a drag or the keyboard and not yet let go, with its price. */
  const [preview, setPreview] = useState<{ key: string; price: number } | null>(null);
  /** An exit being added: it follows the pointer until a click on the chart places it. */
  const [adding, setAdding] = useState<{ role: Role; price: number } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const menuBox = useRef<HTMLDivElement>(null);

  const average = lines.find((line) => line.tone === "average");
  const hasStop = lines.some((line) => line.tone === "stop");
  const hasTarget = lines.some((line) => line.tone === "target");
  /** Gross P&L on the position if it closed at `price`. */
  const pnlAt = (price: number) => (average ? (price - average.price) * average.quantity : null);
  const snap = (rupeesValue: number) => Math.max(tick, Math.round((rupeesValue * 100) / tick) * tick);
  /** The price at a height in the price pane, on the tick; null outside it. */
  const priceAt = (y: number) => {
    const value = y >= 0 && y <= chart.paneSize(0).height ? series.coordinateToPrice(y) : null;
    return value === null ? null : snap(value);
  };
  const shownPrice = (line: ChartLine) => (preview?.key === lineKey(line) ? preview.price : pending[lineKey(line)] ?? line.price);

  /** Run one request; its error shows on the chart. */
  const settle = async (key: string, task: () => Promise<string | null>) => {
    setBusy((keys) => [...keys, key]);
    try {
      const failed = await task();
      if (failed) setError(failed);
    } finally {
      setBusy((keys) => keys.filter((item) => item !== key));
    }
  };

  const showLine = (key: string, price: number) => drawn.current.get(key)?.applyOptions({ price: price / 100 });

  /** Open the menu at a point on the chart, if there's anything to offer at its price. */
  const openMenu = (x: number, y: number, price: number): boolean => {
    const actions = trading.actions(price);
    if (actions.length === 0) return false;
    const { clientWidth: width, clientHeight: height } = chart.chartElement();
    setMenu({ price, actions, place: { ...(x > width / 2 ? { right: width - x } : { left: x }), ...(y > height / 2 ? { bottom: height - y } : { top: y }) } });
    return true;
  };

  /** Let a moved line go: send its new price, and keep it there until the account answers. */
  const commitMove = (line: ChartLine, price: number) => {
    const key = lineKey(line);
    setPreview(null);
    if (price === line.price) return showLine(key, line.price);
    onPending(key, price);
    void settle(key, () => trading.move(line, price)).finally(() => onPending(key, null));
  };
  const revertMove = (line: ChartLine) => {
    setPreview(null);
    showLine(lineKey(line), pending[lineKey(line)] ?? line.price);
  };

  const startAdding = (role: Role, price: number) => {
    setMenu(null);
    if (!draft.current) draft.current = series.createPriceLine({ price: price / 100, color: colors[role], lineWidth: 1, lineStyle: DOTTED, axisLabelVisible: true, title: "" });
    else draft.current.applyOptions({ price: price / 100, color: colors[role] });
    setAdding({ role, price });
  };
  const moveDraft = (role: Role, price: number) => {
    draft.current?.applyOptions({ price: price / 100 });
    setAdding({ role, price });
  };
  const stopAdding = () => {
    if (draft.current) series.removePriceLine(draft.current);
    draft.current = null;
    setAdding(null);
  };
  const commitAdd = (role: Role, price: number) => {
    stopAdding();
    void settle(`add-${role}`, () => trading.addExit(role, price));
  };

  // Labels sit on their lines as the chart scrolls, zooms and rescales.
  useEffect(() => {
    let frame = 0;
    const place = () => {
      const height = chart.paneSize(0).height;
      const right = `${chart.priceScale("right").width() + 30}px`;
      for (const element of chips.current.values()) {
        const y = series.priceToCoordinate(Number(element.dataset.price) / 100);
        const at = y !== null && y >= 0 && y <= height ? `translate(0, ${Math.round(y)}px) translateY(-50%)` : "";
        if (element.dataset.at !== at) {
          element.dataset.at = at;
          element.style.transform = at;
          element.style.visibility = at ? "" : "hidden";
        }
        if (element.style.right !== right) element.style.right = right;
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [chart, series]);

  // An exit being added goes when the chart does.
  useEffect(() => () => {
    if (draft.current) series.removePriceLine(draft.current);
    draft.current = null;
  }, [series]);

  const onCrosshair = useEffectEvent((param: MouseEventParams<Time>) => {
    const y = param.point && param.paneIndex === 0 ? param.point.y : null;
    const price = y === null ? null : priceAt(y);
    if (adding) {
      if (price !== null && !press.current) moveDraft(adding.role, price);
      return;
    }
    const button = plus.current;
    if (!button) return;
    if (y === null || price === null) {
      if (!overPlus.current) button.hidden = true;
      return;
    }
    plusPrice.current = price;
    button.hidden = false;
    button.style.transform = `translate(0, ${Math.round(y)}px) translateY(-50%)`;
    button.style.right = `${chart.priceScale("right").width() + 2}px`;
  });
  const onChartClick = useEffectEvent((param: MouseEventParams<Time>) => {
    if (!adding || !param.point || param.paneIndex !== 0) return;
    const price = priceAt(param.point.y);
    if (price !== null) commitAdd(adding.role, price);
  });
  const onContextMenu = useEffectEvent((event: MouseEvent) => {
    const box = chart.chartElement().getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const price = priceAt(y);
    if (price === null || !openMenu(x, y, price)) return;
    event.preventDefault();
    stopAdding();
  });
  const onKey = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (adding) stopAdding();
    if (menu) setMenu(null);
  });
  useEffect(() => {
    const element = chart.chartElement();
    const crosshair = (param: MouseEventParams<Time>) => onCrosshair(param);
    const click = (param: MouseEventParams<Time>) => onChartClick(param);
    const context = (event: MouseEvent) => onContextMenu(event);
    const key = (event: globalThis.KeyboardEvent) => onKey(event);
    chart.subscribeCrosshairMove(crosshair);
    chart.subscribeClick(click);
    element.addEventListener("contextmenu", context);
    window.addEventListener("keydown", key);
    return () => {
      chart.unsubscribeCrosshairMove(crosshair);
      chart.unsubscribeClick(click);
      element.removeEventListener("contextmenu", context);
      window.removeEventListener("keydown", key);
    };
  }, [chart]);

  // The menu closes on a press anywhere else, and takes focus when it opens.
  useEffect(() => {
    if (!menu) return;
    menuBox.current?.querySelector("button")?.focus({ preventScroll: true });
    const away = (event: globalThis.PointerEvent) => {
      if (!menuBox.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  // An error shows for a few seconds.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(timer);
  }, [error]);

  /** Press on a line's label, or on SL or TP: follow the pointer from here. */
  const onPress = (event: PointerEvent<HTMLElement>, target: Press["target"], price: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { pointerId: event.pointerId, startY: event.clientY, target, price, moved: false };
    setMenu(null);
  };
  const onDrag = (event: PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.abs(event.clientY - current.startY) < DRAG_SLOP) return;
    const box = chart.chartElement().getBoundingClientRect();
    const price = priceAt(Math.min(Math.max(event.clientY - box.top, 0), chart.paneSize(0).height));
    if (price === null) return;
    current.price = price;
    if ("line" in current.target) {
      if (!current.moved) setMenu(null);
      showLine(lineKey(current.target.line), price);
      setPreview({ key: lineKey(current.target.line), price });
    } else if (!current.moved) startAdding(current.target.role, price);
    else moveDraft(current.target.role, price);
    current.moved = true;
  };
  const onRelease = (event: PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    press.current = null;
    if ("line" in current.target) {
      if (current.moved) commitMove(current.target.line, current.price);
      return;
    }
    // A drag from SL or TP places the exit where it's let go; a click starts placing it on the chart.
    if (current.moved) commitAdd(current.target.role, current.price);
    else if (adding?.role === current.target.role) stopAdding();
    else startAdding(current.target.role, average?.price ?? last ?? tick);
  };
  const onCancelPress = (event: PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    press.current = null;
    if ("line" in current.target) revertMove(current.target.line);
    else stopAdding();
  };

  /** Arrow keys move a focused line by a tick (ten with Shift); Enter sends it, Escape puts it back. */
  const onLineKey = (event: KeyboardEvent<HTMLButtonElement>, line: ChartLine) => {
    const key = lineKey(line);
    const from = preview?.key === key ? preview.price : shownPrice(line);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const price = Math.max(tick, from + (event.key === "ArrowUp" ? 1 : -1) * tick * (event.shiftKey ? 10 : 1));
      showLine(key, price);
      setPreview({ key, price });
    } else if (event.key === "Enter" && preview?.key === key) {
      event.preventDefault();
      commitMove(line, preview.price);
    } else if (event.key === "Escape" && preview?.key === key) {
      event.preventDefault();
      event.stopPropagation();
      revertMove(line);
    }
  };
  /** The same keys for an exit being added. */
  const onAddKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!adding) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      moveDraft(adding.role, Math.max(tick, adding.price + (event.key === "ArrowUp" ? 1 : -1) * tick * (event.shiftKey ? 10 : 1)));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitAdd(adding.role, adding.price);
    }
  };
  /** SL or TP from the keyboard: the exit starts a step from the last price, to move with the arrow keys. */
  const onAddClick = (event: ReactMouseEvent<HTMLButtonElement>, role: Role) => {
    if (event.detail !== 0) return; // pointer presses are handled by onPress and onRelease
    if (adding?.role === role) return stopAdding();
    const from = last ?? average?.price ?? tick;
    startAdding(role, snap(((role === "stop" ? 0.95 : 1.05) * from) / 100));
  };

  const keep = (key: string) => (element: HTMLElement | null) => {
    if (!element) return;
    chips.current.set(key, element);
    return () => {
      chips.current.delete(key);
    };
  };

  const chip = "pointer-events-auto absolute right-0 top-0 flex items-center overflow-hidden rounded border bg-[var(--card)] font-mono text-[10px] leading-none shadow-sm shadow-black/20";
  const cell = "flex h-5 items-center gap-1 px-1.5";
  const iconButton = "flex h-5 w-5 items-center justify-center border-l border-[var(--border)] text-[var(--muted)] hover:bg-[var(--card-raised)] hover:text-[var(--foreground)] disabled:opacity-40";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {lines.map((line) => {
        const key = lineKey(line);
        const price = shownPrice(line);
        const waiting = key in pending || busy.includes(key);
        if (line.tone === "average") {
          const pnl = last === null ? null : pnlAt(last);
          return (
            <div key={key} ref={keep(key)} data-price={price} role="group" aria-label={`Position ${line.quantity > 0 ? "+" : ""}${line.quantity} at ${rupees(line.price)}`} className={`${chip} ${TONE.average}`}>
              <span className={cell}>
                <span className={TITLE.average}>{line.quantity > 0 ? "+" : ""}{line.quantity}</span>
                {pnl !== null && <span className={pnlTone(pnl)}>{signed(pnl)}</span>}
              </span>
              {([["stop", hasStop], ["target", hasTarget]] as const).map(([role, has]) => !has && (
                <button key={role} type="button" aria-pressed={adding?.role === role} aria-label={`Add a ${ROLE_NAME[role]}`} title={`Add a ${ROLE_NAME[role]}: drag it to a price, or click here and then the chart`}
                  onPointerDown={(event) => onPress(event, { role }, line.price)} onPointerMove={onDrag} onPointerUp={onRelease} onPointerCancel={onCancelPress}
                  onClick={(event) => onAddClick(event, role)} onKeyDown={onAddKey}
                  className={`h-5 cursor-ns-resize touch-none border-l border-[var(--border)] px-1.5 ${role === "stop" ? "text-[var(--chart-down)]" : "text-[var(--chart-up)]"} ${adding?.role === role ? "bg-[var(--card-raised)]" : "hover:bg-[var(--card-raised)]"}`}>
                  {ROLE_TITLE[role]}
                </button>
              ))}
              <button type="button" disabled={busy.includes(key)} onClick={() => void settle(key, () => trading.cancel(line))} aria-label="Close the position at market" title="Close the position at market" className={iconButton}><X className="h-3 w-3" aria-hidden="true" /></button>
            </div>
          );
        }
        const pnl = line.tone === "order" ? null : pnlAt(price);
        const name = line.tone === "stop" ? "Stop-loss" : line.tone === "target" ? "Target" : line.title;
        return (
          <div key={key} ref={keep(key)} data-price={price} role="group" aria-label={`${name} at ${rupees(price)}`} className={`${chip} ${TONE[line.tone]} ${waiting ? "opacity-60" : ""}`}>
            <button type="button" aria-label={`${name} at ${rupees(price)}. Drag, or use the arrow keys and Enter, to move it.`} title="Drag to move"
              onPointerDown={(event) => onPress(event, { line }, price)} onPointerMove={onDrag} onPointerUp={onRelease} onPointerCancel={onCancelPress}
              onKeyDown={(event) => onLineKey(event, line)} onBlur={() => { if (preview?.key === key) revertMove(line); }}
              className={`${cell} cursor-ns-resize touch-none hover:bg-[var(--card-raised)]`}>
              <span className={TITLE[line.tone]}>{line.tone === "order" ? line.title : ROLE_TITLE[line.tone]}</span>
              {preview?.key === key && <span className="text-[var(--foreground)]">{priceText.format(price / 100)}</span>}
              {pnl !== null ? <span className={pnlTone(pnl)}>{signed(pnl)}</span> : <span className="text-[var(--faint)]">{line.quantity}</span>}
            </button>
            <button type="button" disabled={busy.includes(key)} onClick={() => void settle(key, () => trading.cancel(line))} aria-label={line.tone === "order" ? `Cancel the ${line.title} order` : `Remove the ${ROLE_NAME[line.tone]}`} title={line.tone === "order" ? "Cancel the order" : `Remove the ${ROLE_NAME[line.tone]}`} className={iconButton}><X className="h-3 w-3" aria-hidden="true" /></button>
          </div>
        );
      })}

      {adding && (() => {
        const pnl = pnlAt(adding.price);
        return (
          <div ref={keep("adding")} data-price={adding.price} role="status" className={`${chip} ${TONE[adding.role]} border-dashed`}>
            <span className={cell}>
              <span className={TITLE[adding.role]}>{ROLE_TITLE[adding.role]}</span>
              <span className="text-[var(--foreground)]">{priceText.format(adding.price / 100)}</span>
              {pnl !== null && <span className={pnlTone(pnl)}>{signed(pnl)}</span>}
              <span className="font-sans text-[var(--muted)]">Click the chart to set · Esc</span>
            </span>
          </div>
        );
      })()}

      <button ref={plus} type="button" hidden aria-label="Orders at this price" title="Orders at this price"
        onPointerEnter={() => { overPlus.current = true; }}
        onPointerLeave={(event) => { overPlus.current = false; event.currentTarget.hidden = true; }}
        onClick={(event) => {
          const price = plusPrice.current;
          const box = chart.chartElement().getBoundingClientRect();
          const button = event.currentTarget.getBoundingClientRect();
          if (price !== null) openMenu(button.left - box.left, button.top + button.height / 2 - box.top, price);
        }}
        className="pointer-events-auto absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--card-raised)] text-[var(--foreground)] hover:border-[var(--primary)]">
        <Plus className="h-3 w-3" aria-hidden="true" />
      </button>

      {menu && (
        <div ref={menuBox} role="menu" aria-label={`Orders at ${rupees(menu.price)}`}
          onKeyDown={(event) => {
            const items = [...(menuBox.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
            const at = items.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
            }
          }}
          style={menu.place}
          className="pointer-events-auto absolute z-10 min-w-48 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] p-1 text-xs shadow-xl shadow-black/30">
          {menu.actions.map((action) => (
            <button key={action.label} type="button" role="menuitem" onClick={() => { setMenu(null); void settle("menu", () => action.run()); }} className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--card-raised)] focus:bg-[var(--card-raised)] focus:outline-none">
              {action.label}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="pointer-events-auto absolute left-1/2 top-9 max-w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-[var(--danger)]/60 bg-[var(--card-raised)] px-3 py-2 text-xs leading-5 text-[var(--danger)] shadow-lg shadow-black/30">{error}</p>}
    </div>
  );
}
