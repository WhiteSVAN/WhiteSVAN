"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { TradingWorkspace } from "@/components/markets/trading-workspace";
import { PriceChart } from "@/components/markets/price-chart";
import { AccountBlotter, AccountSummary, AccountTicket, OrderBook, type ExitsInput, type OrderInput, type PickedPrice } from "@/components/markets/account-panel";
import type { ChartAction, ChartTrading } from "@/components/markets/chart-orders";
import { foldTick, type Candle, type Interval, type LiveTick } from "@/lib/market-data/candles";
import { chartLines, exitRole, positionExits, type Desk, type DeskNote } from "@/lib/trading/desk";
import { netQuantity, type EngineOutput, type OrderChanges } from "@/lib/trading/engine";
import type { Side, Underlying } from "@/lib/trading/instruments";
import { clockSeconds, toIst } from "@/lib/trading/time";
import { quoteKey, UNDERLYINGS, type InstrumentList, type KiteContract, type MarketQuote } from "@/lib/zerodha/kite";
import { chainWindow, DEFAULT_STRIKES_EACH_SIDE, isStrikesEachSide, nearestStrike, STRIKES_EACH_SIDE, type StrikesEachSide } from "@/lib/zerodha/chain";

type Right = "CE" | "PE";
/** What the chart shows: the index, or the option picked in the chain. */
type Charted = "index" | "option";

const UNDERLYING_ORDER: Underlying[] = ["NIFTY", "BANKNIFTY", "SENSEX"];
const INTERVAL_CHOICES: [Interval, string, string][] = [
  ["minute", "1m", "1-minute"],
  ["3minute", "3m", "3-minute"],
  ["5minute", "5m", "5-minute"],
  ["15minute", "15m", "15-minute"],
  ["30minute", "30m", "30-minute"],
  ["60minute", "1h", "hourly"],
  ["day", "1D", "daily"],
];
const NO_CANDLES: Candle[] = [];

const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const strikeText = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const countText = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });
const clockText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const expiryText = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const price = (paise: number) => priceText.format(paise / 100);
const expiryLabel = (date: string) => expiryText.format(new Date(`${date}T00:00:00Z`));

function contractLabel(contract: KiteContract): string {
  const day = expiryText.formatToParts(new Date(`${contract.expiry}T00:00:00Z`));
  const part = (type: string) => day.find((item) => item.type === type)?.value ?? "";
  return `${UNDERLYINGS[contract.underlying].contractName} ${part("day")} ${part("month")} ${strikeText.format((contract.strike ?? 0) / 100)} ${contract.kind}`;
}

/** Weekday trading hours with a few minutes either side; quotes poll faster then. */
function marketHours(at: number): boolean {
  const { weekday, second } = toIst(at);
  return weekday >= 1 && weekday <= 5 && second >= clockSeconds("09:10") && second < clockSeconds("15:35");
}

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal, init?: { method: "POST" | "PATCH" | "DELETE"; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    method: init?.method ?? "GET",
    ...(init?.body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : {}),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" ? body.message : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

function Change({ quote, className = "" }: { quote: MarketQuote; className?: string }) {
  if (quote.previousClose <= 0) return null;
  const change = quote.lastPrice - quote.previousClose;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const percent = ((Math.abs(change) * 100) / quote.previousClose).toFixed(2);
  return (
    <span className={`font-mono ${change >= 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"} ${className}`}>
      {sign}{price(Math.abs(change))} ({sign}{percent}%)
    </span>
  );
}

/** A row of toggle buttons; an option's third entry, when given, is its full name. */
function Choice<T extends string | number>({ label, value, options, onChange, className = "" }: { label: string; value: T; options: readonly (readonly [T, string, string?])[]; onChange: (value: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-0.5 ${className}`}>
      {options.map(([option, text, name]) => (
        <button key={String(option)} type="button" aria-pressed={option === value} aria-label={name} title={name} onClick={() => onChange(option)} className={`min-h-7 whitespace-nowrap rounded-md px-2 font-mono text-[11px] transition ${option === value ? "bg-[var(--ink)] text-[var(--ink-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

const selectClass = "min-h-8 rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-2 font-mono text-[11px] text-[var(--foreground)]";

/** The shared login ended mid-session. Owners get the login link (`loginHref`); everyone else waits for them. */
function SessionEnded({ message, loginHref }: { message: string; loginHref: string | null }) {
  return (
    <div className="terminal-card px-6 py-12 text-center">
      <h2 className="text-xl font-medium tracking-tight">{loginHref ? "Connect live prices again" : "Live prices are offline"}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
      {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
      {loginHref && <a href={loginHref} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]">Connect live prices</a>}
    </div>
  );
}

/** Where Buy and Sell send someone without an account. */
function OpenEvaluation() {
  return (
    <aside id="order-ticket" className="terminal-card flex scroll-mt-24 flex-col overflow-hidden" aria-label="Order ticket">
      <div className="flex h-11 shrink-0 items-center border-b border-[var(--border)] px-3"><h2 className="text-sm font-medium">Order ticket</h2></div>
      <div className="space-y-3 p-3">
        <p className="font-medium">Start an evaluation to place orders</p>
        <p className="text-sm leading-6 text-[var(--muted)]">Your demo account trades these options on live prices, with this ticket, positions and a full order book.</p>
        <Link id="open-evaluation" href="/checkout" className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]">Start an evaluation</Link>
      </div>
    </aside>
  );
}

/** One side of a chain row: the option's last price (charts it) and its Buy and Sell buttons. */
function ChainCell({ contract, quote, side, itm, selected, onSelect, onTrade }: { contract: KiteContract | null; quote: MarketQuote | undefined; side: Right; itm: boolean; selected: boolean; onSelect: () => void; onTrade: (side: Side) => void }) {
  if (!contract) return <td colSpan={2} className="px-1 py-1 text-center text-[var(--faint)]">—</td>;
  const label = contractLabel(contract);
  const change = quote && quote.previousClose > 0 ? quote.lastPrice - quote.previousClose : null;
  const percent = quote && change !== null ? ((Math.abs(change) * 100) / quote.previousClose).toFixed(1) : null;
  const priceCell = (
    <td className={`px-1 py-1 ${side === "CE" ? "text-right" : "text-left"} ${itm ? "bg-[var(--card-raised)]" : ""}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Chart ${label}`} className={`inline-flex min-h-8 min-w-14 flex-col rounded-md px-1.5 py-0.5 ${side === "CE" ? "items-end" : "items-start"} ${selected ? "ring-1 ring-[var(--primary)]" : "hover:bg-[var(--card-deep)]"}`}>
        <span className="font-mono text-sm">{quote ? price(quote.lastPrice) : "—"}</span>
        {change !== null && percent !== null && <span className={`font-mono text-[10px] ${change >= 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{change >= 0 ? "+" : "−"}{percent}%</span>}
      </button>
    </td>
  );
  const buttons = (
    <td className={`px-0.5 py-1 ${itm ? "bg-[var(--card-raised)]" : ""}`}>
      <span className={`flex gap-0.5 ${side === "CE" ? "justify-end" : ""}`}>
        <button type="button" onClick={() => onTrade("BUY")} aria-label={`Buy ${label}`} className="min-h-8 min-w-7 rounded bg-[var(--primary)] px-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">B</button>
        <button type="button" onClick={() => onTrade("SELL")} aria-label={`Sell ${label}`} className="min-h-8 min-w-7 rounded bg-[var(--danger)] px-1.5 text-xs font-medium text-[var(--danger-foreground)] hover:opacity-90">S</button>
      </span>
    </td>
  );
  return side === "CE" ? <>{priceCell}{buttons}</> : <>{buttons}{priceCell}</>;
}

const ALERTS_SHOWN = 3;
const ALERT_MS = 6_000;
const noteKey = (note: DeskNote) => `${note.at}|${note.text}`;

/** Notes in `next` that `previous` didn't have: the newest come first, ahead of what was there. */
function newNotes(previous: readonly DeskNote[], next: readonly DeskNote[]): DeskNote[] {
  if (previous.length === 0) return [];
  const seen = next.findIndex((note) => noteKey(note) === noteKey(previous[0]));
  return (seen === -1 ? next : next.slice(0, seen)).slice(0, ALERTS_SHOWN);
}

const withParam = (path: string, name: string, value: string) => `${path}${path.includes("?") ? "&" : "?"}${name}=${encodeURIComponent(value)}`;

/**
 * Options trading on live prices for NIFTY, BANK NIFTY and SENSEX, as a workspace of panels the
 * trader can arrange (TradingWorkspace): the chart (the index, or the option picked in the chain),
 * the option chain around the money with Buy and Sell on every option, the picked option's order
 * book and the order ticket. With an `account`, the account bar carries its figures and rule
 * meters, its positions, orders and trades sit under the chart, and each poll feeds the account on
 * the server. `header` opens the account bar (the page's title). `canConnect` marks an owner, who
 * can reconnect the price feed when it ends. `home` is the page to come back to; `accounts` lets
 * someone with several accounts switch. `startOn` picks the first index tab (SENSEX on a feed that carries only it).
 */
export function ZerodhaCharts({ header, account, canConnect, home: homePath, accounts, startOn }: { header?: ReactNode; account?: { id: string; desk: Desk }; canConnect: boolean; home?: string; accounts?: { id: string; label: string; href: string }[]; startOn?: Underlying }) {
  const [underlying, setUnderlying] = useState<Underlying>(startOn ?? "NIFTY");
  const [barInterval, setBarInterval] = useState<Interval>("5minute");
  const [expiryChoice, setExpiryChoice] = useState<string | null>(null);
  /** The ticket's option; it follows the money until the trader picks one. */
  const [pick, setPick] = useState<{ strike: number; right: Right } | null>(null);
  const [charted, setCharted] = useState<Charted>("index");
  /** Strikes either side of the money; the chain scrolls. */
  const [eachSide, setEachSide] = useState<StrikesEachSide>(DEFAULT_STRIKES_EACH_SIDE);
  const chainBox = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<InstrumentList | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ key: string; candles: Candle[] } | null>(null);
  const [historyError, setHistoryError] = useState<{ key: string; message: string } | null>(null);
  const [reloads, setReloads] = useState(0);
  const [live, setLive] = useState<{ key: string; candle: Candle } | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [polledAt, setPolledAt] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const router = useRouter();
  const home = homePath ?? (account ? `/trade/${account.id}` : "/markets");
  // The price feed's 06:00 logout or a revoked token: re-render the page from the server, which now
  // offers owners a fresh login and shows everyone else the offline card.
  const sessionEnded = useCallback((message: string) => {
    setEnded(message);
    router.replace(withParam(home, "feed", canConnect ? "ended" : "offline"));
  }, [router, home, canConnect]);
  const latestQuotes = useRef<Record<string, MarketQuote>>({});
  const lastPoll = useRef(0);
  /** The list the selection was made from, and whether it sits on a real money line yet. */
  const listRef = useRef<InstrumentList | null>(null);
  const centred = useRef(false);
  const userPicked = useRef(false);
  const [desk, setDeskState] = useState<Desk | null>(account?.desk ?? null);
  const latestDesk = useRef<Desk | null>(account?.desk ?? null);
  const [alerts, setAlerts] = useState<(DeskNote & { key: number })[]>([]);
  const alertCount = useRef(0);
  // Never step back to an older snapshot: a poll answered after an order can carry the desk from
  // before it. What the account did since the last snapshot (fills, stops, targets) pops up.
  const setDesk = useCallback((next: Desk) => {
    const current = latestDesk.current;
    if (current && next.state.clock < current.state.clock) return;
    latestDesk.current = next;
    setDeskState(next);
    const fresh = newNotes(current?.notes ?? [], next.notes);
    if (fresh.length > 0) setAlerts((shown) => [...fresh.map((note) => ({ ...note, key: (alertCount.current += 1) })), ...shown].slice(0, ALERTS_SHOWN));
  }, []);
  // Each alert stays a few seconds; the oldest goes first.
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setTimeout(() => setAlerts((shown) => shown.slice(0, -1)), ALERT_MS);
    return () => clearTimeout(timer);
  }, [alerts]);
  const [side, setSide] = useState<Side>("BUY");
  /** The ticket's size, which orders placed from the chart use too. */
  const [lots, setLots] = useState(1);
  /** The last price picked in the order book, for the ticket's limit. */
  const [picked, setPicked] = useState<PickedPrice | null>(null);
  const accountId = account?.id ?? null;

  const data = list?.underlying === underlying ? list : null;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ underlying });
    if (expiryChoice) query.set("expiry", expiryChoice);
    getJson<InstrumentList>(`/api/zerodha/instruments?${query}`, controller.signal)
      .then((next) => {
        listRef.current = next;
        setList(next);
        setListError(null);
        const spot = latestQuotes.current[next.index.key]?.lastPrice;
        centred.current = spot !== undefined;
        setPick((current) => {
          if (current && userPicked.current && next.chain.some((row) => row.strike === current.strike)) return current;
          const strike = nearestStrike(next.chain, spot);
          return strike === null ? null : { strike, right: current?.right ?? "CE" };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
        else setListError(error instanceof Error ? error.message : "Could not load the option chain.");
      });
    return () => controller.abort();
  }, [underlying, expiryChoice, reloads, sessionEnded]);

  const spot = data ? quotes[data.index.key]?.lastPrice : undefined;
  const atm = data ? nearestStrike(data.chain, spot) : null;
  const rows = data ? chainWindow(data.chain, atm, eachSide) : [];
  const selectedRow = data && pick ? data.chain.find((row) => row.strike === pick.strike) : undefined;
  const contract = selectedRow && pick ? (pick.right === "CE" ? selectedRow.call : selectedRow.put) : null;
  const selectedKey = contract ? quoteKey(contract) : null;
  // The index until an option is charted (and whenever the chain has none to chart).
  const chartsOption = charted === "option" && contract !== null;
  const token = data ? (chartsOption ? contract.token : data.index.token) : null;
  const chartedKey = data ? (chartsOption ? selectedKey : data.index.key) : null;
  const chartKey = token === null ? null : `${token}|${barInterval}`;
  const candles = history && history.key === chartKey ? history.candles : null;
  // The ticket's option first (it gets full depth), then the index for the money line, then the chain.
  // A string, so the poll restarts only when the set of contracts changes.
  const keysText = data
    ? [...new Set([...(selectedKey ? [selectedKey] : []), data.index.key, ...rows.flatMap((row) => [row.call, row.put].flatMap((item) => (item ? [quoteKey(item)] : [])))])].join("\n")
    : "";

  // The money row sits mid-chain when the chain, the money or the window changes; scrolling is the trader's after that.
  const centreKey = data ? `${data.underlying}|${data.expiry}|${atm}|${eachSide}` : "";
  useEffect(() => {
    const box = chainBox.current;
    const row = box?.querySelector<HTMLElement>("[data-atm]");
    if (box && row) box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
  }, [centreKey]);

  useEffect(() => {
    if (token === null) return;
    const key = `${token}|${barInterval}`;
    const controller = new AbortController();
    const query = new URLSearchParams({ token: String(token), interval: barInterval, ...(chartsOption ? { oi: "1" } : {}) });
    getJson<{ candles: Candle[] }>(`/api/zerodha/candles?${query}`, controller.signal)
      .then((body) => setHistory({ key, candles: body.candles }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
        else setHistoryError({ key, message: error instanceof Error ? error.message : "Could not load candles." });
      });
    return () => controller.abort();
  }, [token, chartsOption, barInterval, reloads, sessionEnded]);

  useEffect(() => {
    if (!keysText) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous: LiveTick | null = null;
    let current: Candle | null = candles?.[candles.length - 1] ?? null;
    const keys = keysText.split("\n");
    const poll = async () => {
      let delay = marketHours(Date.now()) ? 1_000 : 20_000;
      if (!document.hidden) {
        lastPoll.current = Date.now();
        try {
          // One quote call per poll; on an account the server puts the account's own contracts first.
          const body: { quotes: MarketQuote[]; desk?: Desk } = accountId
            ? await getJson(`/api/accounts/${accountId}/tick`, undefined, { method: "POST", body: { keys } })
            : await getJson(`/api/zerodha/quotes?${new URLSearchParams(keys.map((key) => ["i", key]))}`);
          // Prices and the account are kept even when the poll restarted while this was in flight.
          if (body.desk) setDesk(body.desk);
          latestQuotes.current = { ...latestQuotes.current, ...Object.fromEntries(body.quotes.map((quote) => [quote.key, quote])) };
          setQuotes(latestQuotes.current);
          setPolledAt(Date.now());
          setQuoteError(null);
          // The first index price puts a selection the trader didn't make at the money.
          const listed = listRef.current;
          const indexPrice = listed ? latestQuotes.current[listed.index.key]?.lastPrice : undefined;
          if (listed && indexPrice !== undefined && !centred.current && !userPicked.current) {
            centred.current = true;
            const strike = nearestStrike(listed.chain, indexPrice);
            if (strike !== null) setPick((now) => ({ strike, right: now?.right ?? "CE" }));
          }
          if (stopped) return;
          const quote = body.quotes.find((item) => item.key === chartedKey);
          if (quote && candles && chartKey) {
            const tick: LiveTick = { at: quote.lastTradeAt ?? quote.at, price: quote.lastPrice, dayVolume: quote.volume, oi: quote.oi };
            const next = foldTick(current, tick, barInterval, previous);
            previous = tick;
            if (next) {
              current = next;
              setLive({ key: chartKey, candle: next });
            }
          }
        } catch (error) {
          if (stopped) return;
          if (error instanceof ApiError && error.status === 401) return sessionEnded(error.message);
          if (error instanceof ApiError && error.status === 429) delay = 5_000;
          setQuoteError(error instanceof Error ? error.message : "Live prices paused.");
        }
      }
      if (!stopped) timer = setTimeout(poll, delay);
    };
    // One quote request a second, so a restart waits for the last poll's second to pass.
    timer = setTimeout(poll, Math.max(0, 1_100 - (Date.now() - lastPoll.current)));
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [keysText, chartedKey, accountId, chartKey, candles, barInterval, sessionEnded, setDesk]);

  const sendOrder = useCallback(async (order: OrderInput): Promise<EngineOutput[]> => {
    if (!accountId) return [];
    try {
      const body = await getJson<{ outputs: EngineOutput[]; desk: Desk }>(`/api/accounts/${accountId}/orders`, undefined, { method: "POST", body: order });
      setDesk(body.desk);
      return body.outputs;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
      throw error;
    }
  }, [accountId, sessionEnded, setDesk]);
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!accountId) return;
    const body = await getJson<{ desk: Desk }>(`/api/accounts/${accountId}/orders/${encodeURIComponent(orderId)}`, undefined, { method: "DELETE" });
    setDesk(body.desk);
  }, [accountId, setDesk]);
  const modifyOrder = useCallback(async (orderId: string, changes: OrderChanges): Promise<EngineOutput[]> => {
    if (!accountId) return [];
    try {
      const body = await getJson<{ outputs: EngineOutput[]; desk: Desk }>(`/api/accounts/${accountId}/orders/${encodeURIComponent(orderId)}`, undefined, { method: "PATCH", body: changes });
      setDesk(body.desk);
      return body.outputs;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
      throw error;
    }
  }, [accountId, sessionEnded, setDesk]);

  /** Set, move or remove a held option's stop-loss and target. */
  const setExits = useCallback(async (token: number, exits: ExitsInput): Promise<EngineOutput[]> => {
    if (!accountId) return [];
    try {
      const body = await getJson<{ outputs: EngineOutput[]; desk: Desk }>(`/api/accounts/${accountId}/exits`, undefined, { method: "POST", body: { token, ...exits } });
      setDesk(body.desk);
      return body.outputs;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
      throw error;
    }
  }, [accountId, sessionEnded, setDesk]);

  /** Put an option from the chain on the ticket. */
  const select = (strike: number, right: Right) => {
    userPicked.current = true;
    setPick({ strike, right });
  };
  /** Chart an option from the chain (it goes on the ticket too). */
  const chart = (strike: number, right: Right) => {
    select(strike, right);
    setCharted("option");
  };
  /** Buy or Sell: set the ticket's side and bring it into view, or point to evaluations. */
  const trade = (next: Side) => {
    setSide(next);
    document.getElementById("order-ticket")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById(desk ? "ticket-lots" : "open-evaluation")?.focus({ preventScroll: true });
  };
  /** A price picked in the order book becomes the ticket's limit price. */
  const pickPrice = (paise: number) => {
    setPicked((last) => ({ price: paise, key: (last?.key ?? 0) + 1 }));
    setTimeout(() => document.getElementById("ticket-limit")?.focus(), 0);
  };
  const restart = () => {
    userPicked.current = false;
    centred.current = false;
  };
  const chooseUnderlying = (next: Underlying) => {
    if (next === underlying) return;
    restart();
    setUnderlying(next);
    setExpiryChoice(null);
    setPick(null);
  };
  const chooseExpiry = (next: string) => {
    restart();
    setExpiryChoice(next);
  };

  if (ended) return <SessionEnded message={ended} loginHref={canConnect ? `/api/zerodha/login?${new URLSearchParams({ next: home })}` : null} />;

  /**
   * Trading on the charted option's chart: drag its stop-loss, target and working orders, cancel
   * them, close the position, and order at a price. A refused request's message shows on the chart;
   * what the account does shows in the activity alerts.
   */
  function chartTrading(account: Desk, option: KiteContract, last: number | undefined): ChartTrading {
    const attempt = async (task: Promise<unknown>): Promise<string | null> => {
      try {
        await task;
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "That didn't go through. Try again.";
      }
    };
    const position = account.state.positions.find((item) => item.instrument.token === option.token);
    const held = position ? netQuantity(position) : 0;
    const exits = positionExits(account, option.token);
    const size = `${lots} lot${lots === 1 ? "" : "s"}`;
    const toTicket = (at: number): ChartAction => ({ label: `Use ${price(at)} on the ticket`, run: async () => { pickPrice(at); return null; } });
    return {
      actions: (at) => {
        if (last === undefined || at === last) return [toTicket(at)];
        const below = at < last;
        const actions: ChartAction[] = [
          below
            ? { label: `Buy ${size} at ${price(at)} limit`, run: () => attempt(sendOrder({ token: option.token, side: "BUY", lots, type: "LIMIT", limitPrice: at })) }
            : { label: `Buy ${size} at ${price(at)} stop`, run: () => attempt(sendOrder({ token: option.token, side: "BUY", lots, type: "SL", triggerPrice: at, limitPrice: at })) },
        ];
        if (held >= option.lotSize) {
          actions.push(below
            ? { label: `${exits.stop ? "Move stop-loss to" : "Stop-loss at"} ${price(at)}`, run: () => attempt(setExits(option.token, { stopLoss: at })) }
            : { label: `${exits.target ? "Move target to" : "Target at"} ${price(at)}`, run: () => attempt(setExits(option.token, { target: at })) });
        }
        actions.push(toTicket(at));
        return actions;
      },
      move: (line, to) => {
        const order = account.state.orders.find((item) => item.id === line.orderId);
        if (!order) return Promise.resolve("This order isn't working any more.");
        const role = exitRole(order.id);
        if (role) return attempt(setExits(order.token, role === "stop" ? { stopLoss: to } : { target: to }));
        // A stop-limit order keeps the gap between its trigger and its limit.
        const changes: OrderChanges = order.type === "LIMIT" ? { limitPrice: to }
          : order.type === "SL" && order.triggerPrice !== undefined && order.limitPrice !== undefined ? { triggerPrice: to, limitPrice: order.limitPrice + to - order.triggerPrice }
            : { triggerPrice: to };
        return attempt(modifyOrder(order.id, changes));
      },
      cancel: (line) => {
        const role = line.orderId ? exitRole(line.orderId) : null;
        if (line.orderId && role) return attempt(setExits(option.token, role === "stop" ? { stopLoss: null } : { target: null }));
        if (line.orderId) return attempt(cancelOrder(line.orderId));
        return held >= option.lotSize
          ? attempt(sendOrder({ token: option.token, side: "SELL", lots: Math.floor(held / option.lotSize), type: "MARKET" }))
          : Promise.resolve("There is no position to close.");
      },
      addExit: (role, at) => attempt(setExits(option.token, role === "stop" ? { stopLoss: at } : { target: at })),
    };
  }

  const quote = selectedKey ? quotes[selectedKey] : undefined;
  const label = contract ? contractLabel(contract) : null;
  const chartQuote = chartedKey ? quotes[chartedKey] : undefined;
  const chartTitle = chartsOption ? label : data?.index.label ?? UNDERLYINGS[underlying].label;
  const liveCandle = live && live.key === chartKey ? live.candle : null;
  const failed = historyError && historyError.key === chartKey ? historyError.message : null;
  const fresh = chartQuote && polledAt !== null && marketHours(polledAt) && polledAt - (chartQuote.lastTradeAt ?? chartQuote.at) < 60_000;
  const intervalName = INTERVAL_CHOICES.find(([value]) => value === barInterval)?.[2] ?? barInterval;
  const contractName = UNDERLYINGS[underlying].contractName;
  const chartChoices: (readonly [Charted, string, string?])[] = [
    ["index", data?.index.label ?? UNDERLYINGS[underlying].label],
    ...(contract && label ? [["option", `${strikeText.format((contract.strike ?? 0) / 100)} ${contract.kind}`, label] as const] : []),
  ];
  const trading = chartsOption && desk?.state.status === "ACTIVE" ? chartTrading(desk, contract, quote?.lastPrice) : undefined;
  const stats: [string, string][] = chartQuote
    ? [["Open", price(chartQuote.open)], ["High", price(chartQuote.high)], ["Low", price(chartQuote.low)], ["Prev close", price(chartQuote.previousClose)], ...(chartsOption ? [["Volume", countText.format(chartQuote.volume)], ["OI", chartQuote.oi !== null ? countText.format(chartQuote.oi) : "—"]] as [string, string][] : [])]
    : [];

  return (
    <div className="space-y-3">
      {listError && !data && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--danger)]/40 p-3 text-sm text-[var(--danger)]">
          {listError}
          <button type="button" onClick={() => setReloads((count) => count + 1)} className="inline-flex items-center gap-1.5 text-xs underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button>
        </p>
      )}
      <TradingWorkspace
        header={header}
        toolbar={accounts && accounts.length > 1 && account ? (
          <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">Account
            <select value={account.id} onChange={(event) => { const next = accounts.find((item) => item.id === event.target.value); if (next) router.push(next.href); }} className={selectClass}>
              {accounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        ) : undefined}
        metrics={desk ? <AccountSummary desk={desk} /> : undefined}
        chart={
        <section className="ws-chart-panel terminal-card min-w-0 overflow-hidden" aria-label={chartTitle ? `${chartTitle} chart` : "Chart"}>
          {/* One header row like every panel's: the index, what's charted, and the candle interval. */}
          <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[var(--border)] px-2 py-1">
            <Choice label="Index" value={underlying} options={UNDERLYING_ORDER.map((name) => [name, UNDERLYINGS[name].contractName] as const)} onChange={chooseUnderlying} />
            {data && <Choice label="Chart" value={chartsOption ? "option" : "index"} options={chartChoices} onChange={setCharted} />}
            <Choice label="Candle interval" value={barInterval} options={INTERVAL_CHOICES.map(([value, short]) => [value, short] as const)} onChange={setBarInterval} className="ml-auto" />
          </div>
          {data && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
                <h2 className="sr-only">{chartTitle}</h2>
                <span className="font-mono text-sm text-[var(--foreground)]" aria-live="off">{chartQuote ? price(chartQuote.lastPrice) : "—"}</span>
                {chartQuote && <Change quote={chartQuote} className="text-[11px]" />}
                <span className="inline-flex items-center gap-1.5 self-center"><span className={`h-1.5 w-1.5 rounded-full ${fresh ? "bg-[var(--primary)]" : "bg-[var(--faint)]"}`} aria-hidden="true" />{fresh ? "Live" : polledAt !== null && !marketHours(polledAt) ? "Market closed" : "Waiting for prices"}</span>
                {chartQuote && <span>Last update {clockText.format(chartQuote.lastTradeAt ?? chartQuote.at)} IST</span>}
                {stats.map(([term, value]) => <span key={term}>{term} <span className="font-mono text-[var(--foreground)]">{value}</span></span>)}
                {chartsOption && <span>Lot {contract.lotSize} · tick ₹{(contract.tickSize / 100).toFixed(2)}</span>}
                {quoteError && <span className="text-[var(--warning)]">{quoteError}</span>}
              </div>

              <div className="ws-chart-body relative min-h-0 px-1 pt-1">
                <PriceChart fill key={chartsOption ? "option" : "index"} candles={candles ?? NO_CANDLES} live={liveCandle} interval={barInterval} minMove={chartsOption ? contract.tickSize / 100 : 0.05} derivative={chartsOption} label={`${chartTitle}, ${intervalName} candles`} lines={chartsOption && desk ? chartLines(desk, contract.token) : undefined} trading={trading} />
                {!candles && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/60 text-sm text-[var(--muted)]">
                    {failed ? (
                      <span role="alert" className="flex flex-col items-center gap-3 px-6 text-center text-[var(--danger)]">
                        {failed}
                        <button type="button" onClick={() => setReloads((count) => count + 1)} className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)] underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button>
                      </span>
                    ) : "Loading candles…"}
                  </div>
                )}
              </div>
            </>
          )}
          {!data && !listError && <div className="ws-chart-body flex h-[22rem] items-center justify-center text-sm text-[var(--muted)] lg:h-auto">Loading {contractName} options…</div>}
        </section>
        }
        chain={
          <section className="ws-chain-panel terminal-card overflow-hidden" aria-labelledby="chain-title">
            <div className="flex h-11 items-center justify-between gap-3 border-b border-[var(--border)] px-3">
              <h2 id="chain-title" className="text-sm font-medium">{contractName} options</h2>
              {spot !== undefined && data && <p className="truncate font-mono text-[11px] text-[var(--muted)]">{data.index.label} {price(spot)}</p>}
            </div>
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
              {data && data.expiries.length > 0 && (
                <label className="flex min-w-0 flex-1 items-center gap-2">Expiry
                  <select value={data.expiry ?? ""} onChange={(event) => chooseExpiry(event.target.value)} className={`${selectClass} min-w-0 flex-1`}>
                    {data.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiryLabel(expiry)}</option>)}
                  </select>
                </label>
              )}
              <label className="ml-auto flex shrink-0 items-center gap-2" title="Strikes around the money">Strikes
                <select value={eachSide} onChange={(event) => { const next = Number(event.target.value); if (isStrikesEachSide(next)) setEachSide(next); }} className={selectClass}>
                  {STRIKES_EACH_SIDE.map((each) => <option key={each} value={each}>{2 * each + 1}</option>)}
                </select>
              </label>
            </div>
            {!data && !listError && <p className="p-4 text-xs text-[var(--muted)]">Loading the option chain…</p>}
            {data && rows.length === 0 && <p className="p-4 text-xs text-[var(--muted)]">No {contractName} options are listed today.</p>}
            {data && rows.length > 0 && (
              <div ref={chainBox} className="chain-scroll relative max-h-[34rem] overflow-auto">
                <table className="w-full min-w-[320px] text-xs">
                  <caption className="sr-only">{contractName} calls and puts by strike, with buy and sell. Pick a price to chart that option.</caption>
                  <thead className="sticky top-0 z-10 bg-[var(--card)] text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
                    <tr><th scope="col" colSpan={2} className="px-2 py-2 text-right font-normal">Calls</th><th scope="col" className="px-1 py-2 text-center font-normal">Strike</th><th scope="col" colSpan={2} className="px-2 py-2 text-left font-normal">Puts</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((row) => {
                      const isAtm = row.strike === atm && spot !== undefined;
                      return (
                        <tr key={row.strike} data-atm={row.strike === atm ? "" : undefined} className={isAtm ? "bg-[var(--primary)]/5" : ""}>
                          <ChainCell contract={row.call} quote={row.call ? quotes[quoteKey(row.call)] : undefined} side="CE" itm={spot !== undefined && row.strike < spot} selected={pick?.strike === row.strike && pick.right === "CE"} onSelect={() => chart(row.strike, "CE")} onTrade={(value) => { select(row.strike, "CE"); trade(value); }} />
                          <th scope="row" className={`px-1 py-1 text-center font-mono text-xs font-medium ${isAtm ? "text-[var(--primary)]" : ""}`}>{strikeText.format(row.strike / 100)}{isAtm && <span className="block font-sans text-[9px] font-normal uppercase tracking-[0.12em]">ATM</span>}</th>
                          <ChainCell contract={row.put} quote={row.put ? quotes[quoteKey(row.put)] : undefined} side="PE" itm={spot !== undefined && row.strike > spot} selected={pick?.strike === row.strike && pick.right === "PE"} onSelect={() => chart(row.strike, "PE")} onTrade={(value) => { select(row.strike, "PE"); trade(value); }} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] leading-4 text-[var(--faint)]">Pick a price to chart the option; B and S put it on the ticket. Shaded: in the money.</p>
          </section>
        }
        book={<OrderBook quote={quote} label={label} onPrice={desk && account ? pickPrice : undefined} />}
        ticket={desk && account ? <AccountTicket desk={desk} contract={contract} label={label} quote={quote} side={side} onSide={setSide} lots={lots} onLots={setLots} onPlace={sendOrder} picked={picked} /> : <OpenEvaluation />}
        orders={desk ? <AccountBlotter desk={desk} onCancel={cancelOrder} onPlace={sendOrder} onModify={modifyOrder} onExits={setExits} /> : undefined}
      />
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {alerts.map((alert) => (
          <p key={alert.key} role="status" className={`pointer-events-auto rounded-lg border bg-[var(--card-raised)] px-4 py-3 text-xs leading-5 shadow-lg shadow-black/40 ${alert.tone === "good" ? "border-[var(--primary)]/50" : alert.tone === "bad" ? "border-[var(--danger)]/60 text-[var(--danger)]" : "border-[var(--border-strong)]"}`}>{alert.text}</p>
        ))}
      </div>
    </div>
  );
}
