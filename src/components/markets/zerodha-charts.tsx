"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PriceChart } from "@/components/markets/price-chart";
import { AccountBlotter, AccountTicket, type OrderInput } from "@/components/markets/account-panel";
import { foldTick, type Candle, type Interval, type LiveTick } from "@/lib/market-data/candles";
import type { Desk } from "@/lib/trading/desk";
import type { EngineOutput, OrderChanges } from "@/lib/trading/engine";
import type { Side, Underlying } from "@/lib/trading/instruments";
import { clockSeconds, toIst } from "@/lib/trading/time";
import { quoteKey, UNDERLYINGS, type InstrumentList, type KiteContract, type MarketQuote, type OptionStrike } from "@/lib/zerodha/kite";

type Right = "CE" | "PE";

const UNDERLYING_ORDER: Underlying[] = ["NIFTY", "BANKNIFTY", "SENSEX"];
/** Strikes either side of the money in the option chain. */
const CHAIN_SIDE = 6;
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

/** The strike nearest the index (the money), or the chain's middle before the index has a price. */
function nearestStrike(chain: readonly OptionStrike[], target: number | undefined): number | null {
  if (chain.length === 0) return null;
  if (target === undefined) return chain[Math.floor(chain.length / 2)].strike;
  return chain.reduce((best, row) => (Math.abs(row.strike - target) < Math.abs(best - target) ? row.strike : best), chain[0].strike);
}

/** The chain's rows around the money. */
function chainWindow(chain: readonly OptionStrike[], atm: number | null): OptionStrike[] {
  const middle = Math.max(0, chain.findIndex((row) => row.strike === atm));
  return chain.slice(Math.max(0, middle - CHAIN_SIDE), middle + CHAIN_SIDE + 1);
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

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-1">
      {options.map(([option, text]) => (
        <button key={String(option)} type="button" aria-pressed={option === value} onClick={() => onChange(option)} className={`min-h-9 rounded-md px-3 font-mono text-xs transition ${option === value ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

const selectClass = "mt-1 min-h-10 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 font-mono text-xs text-[var(--foreground)] sm:w-auto";

/** The shared login ended mid-session. Owners get the login link (`loginHref`); everyone else waits for them. */
function SessionEnded({ message, loginHref }: { message: string; loginHref: string | null }) {
  return (
    <div className="terminal-card px-6 py-12 text-center">
      <h2 className="text-xl font-medium tracking-tight">{loginHref ? "Connect live prices again" : "Live prices are offline"}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
      {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
      {loginHref && <a href={loginHref} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Connect live prices</a>}
    </div>
  );
}

/** Where Buy and Sell send someone without an evaluation account. */
function OpenEvaluation() {
  return (
    <aside id="order-ticket" className="terminal-card flex scroll-mt-24 flex-col gap-4 p-5" aria-label="Trade">
      <p className="terminal-label">Trade these options</p>
      <h2 className="text-lg font-medium tracking-tight">Open an evaluation to place orders</h2>
      <p className="text-sm leading-6 text-[var(--muted)]">Buy and sell NIFTY, BANK NIFTY and SENSEX options on a simulated account, with an order ticket, positions and a full order book.</p>
      <Link id="open-evaluation" href="/checkout" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start an evaluation</Link>
    </aside>
  );
}

/** One side of a chain row: the option's last price and its Buy and Sell buttons. */
function ChainCell({ contract, quote, side, itm, selected, onSelect, onTrade }: { contract: KiteContract | null; quote: MarketQuote | undefined; side: Right; itm: boolean; selected: boolean; onSelect: () => void; onTrade: (side: Side) => void }) {
  if (!contract) return <td colSpan={2} className="px-2 py-1.5 text-center text-[var(--faint)]">—</td>;
  const label = contractLabel(contract);
  const change = quote && quote.previousClose > 0 ? quote.lastPrice - quote.previousClose : null;
  const percent = quote && change !== null ? ((Math.abs(change) * 100) / quote.previousClose).toFixed(1) : null;
  const priceCell = (
    <td className={`px-2 py-1.5 ${side === "CE" ? "text-right" : "text-left"} ${itm ? "bg-[var(--card-raised)]" : ""}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Chart ${label}`} className={`inline-flex min-h-8 min-w-20 flex-col rounded-md px-2 py-0.5 ${side === "CE" ? "items-end" : "items-start"} ${selected ? "ring-1 ring-[var(--primary)]" : "hover:bg-[var(--card-deep)]"}`}>
        <span className="font-mono text-sm">{quote ? price(quote.lastPrice) : "—"}</span>
        {change !== null && percent !== null && <span className={`font-mono text-[10px] ${change >= 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{change >= 0 ? "+" : "−"}{percent}%</span>}
      </button>
    </td>
  );
  const buttons = (
    <td className={`px-1 py-1.5 ${itm ? "bg-[var(--card-raised)]" : ""}`}>
      <span className="flex gap-1">
        <button type="button" onClick={() => onTrade("BUY")} aria-label={`Buy ${label}`} className="min-h-8 min-w-8 rounded bg-[var(--primary)] px-2 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">B</button>
        <button type="button" onClick={() => onTrade("SELL")} aria-label={`Sell ${label}`} className="min-h-8 min-w-8 rounded bg-[var(--danger)] px-2 text-xs font-medium text-[#2a0f0a] hover:opacity-90">S</button>
      </span>
    </td>
  );
  return side === "CE" ? <>{priceCell}{buttons}</> : <>{buttons}{priceCell}</>;
}

const withParam = (path: string, name: string, value: string) => `${path}${path.includes("?") ? "&" : "?"}${name}=${encodeURIComponent(value)}`;

/**
 * Options trading on live prices for NIFTY, BANK NIFTY and SENSEX: an option chain around the
 * money, the selected option's chart and depth, and, with an evaluation `account`, the order ticket
 * and the account's positions, orders and trades, with each poll feeding the account on the
 * server. `canConnect` marks an owner, who can reconnect the price feed when it ends. `home` is the
 * page to come back to; `accounts` lets someone with several evaluation accounts switch.
 */
export function ZerodhaCharts({ account, canConnect, home: homePath, accounts }: { account?: { id: string; desk: Desk; planLabel: string; demo?: boolean }; canConnect: boolean; home?: string; accounts?: { id: string; label: string; href: string }[] }) {
  const [underlying, setUnderlying] = useState<Underlying>("NIFTY");
  const [barInterval, setBarInterval] = useState<Interval>("5minute");
  const [expiryChoice, setExpiryChoice] = useState<string | null>(null);
  /** The charted option; it follows the money until the trader picks one. */
  const [pick, setPick] = useState<{ strike: number; right: Right } | null>(null);
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
  // Never step back to an older snapshot: a poll answered after an order can carry the desk from before it.
  const setDesk = useCallback((next: Desk) => setDeskState((current) => (current && next.state.clock < current.state.clock ? current : next)), []);
  const [side, setSide] = useState<Side>("BUY");
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
  const rows = data ? chainWindow(data.chain, atm) : [];
  const selectedRow = data && pick ? data.chain.find((row) => row.strike === pick.strike) : undefined;
  const contract = selectedRow && pick ? (pick.right === "CE" ? selectedRow.call : selectedRow.put) : null;
  const selectedKey = contract ? quoteKey(contract) : null;
  const token = contract?.token ?? null;
  const chartKey = token === null ? null : `${token}|${barInterval}`;
  const candles = history && history.key === chartKey ? history.candles : null;
  // The charted option first (it gets full depth), then the index for the money line, then the chain.
  // A string, so the poll restarts only when the set of contracts changes.
  const keysText = data
    ? [...new Set([...(selectedKey ? [selectedKey] : []), data.index.key, ...rows.flatMap((row) => [row.call, row.put].flatMap((item) => (item ? [quoteKey(item)] : [])))])].join("\n")
    : "";

  useEffect(() => {
    if (token === null) return;
    const key = `${token}|${barInterval}`;
    const controller = new AbortController();
    const query = new URLSearchParams({ token: String(token), interval: barInterval, oi: "1" });
    getJson<{ candles: Candle[] }>(`/api/zerodha/candles?${query}`, controller.signal)
      .then((body) => setHistory({ key, candles: body.candles }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
        else setHistoryError({ key, message: error instanceof Error ? error.message : "Could not load candles." });
      });
    return () => controller.abort();
  }, [token, barInterval, reloads, sessionEnded]);

  useEffect(() => {
    if (!keysText) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous: LiveTick | null = null;
    let current: Candle | null = candles?.[candles.length - 1] ?? null;
    const keys = keysText.split("\n");
    const poll = async () => {
      let delay = marketHours(Date.now()) ? 2_000 : 20_000;
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
          const quote = body.quotes.find((item) => item.key === selectedKey);
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
  }, [keysText, selectedKey, accountId, chartKey, candles, barInterval, sessionEnded, setDesk]);

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

  /** Chart an option from the chain. */
  const select = (strike: number, right: Right) => {
    userPicked.current = true;
    setPick({ strike, right });
  };
  /** Buy or Sell: set the ticket's side and bring it into view, or point to evaluations. */
  const trade = (next: Side) => {
    setSide(next);
    document.getElementById("order-ticket")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById(desk ? "ticket-lots" : "open-evaluation")?.focus({ preventScroll: true });
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

  const quote = selectedKey ? quotes[selectedKey] : undefined;
  const label = contract ? contractLabel(contract) : null;
  const liveCandle = live && live.key === chartKey ? live.candle : null;
  const failed = historyError && historyError.key === chartKey ? historyError.message : null;
  const fresh = quote && polledAt !== null && marketHours(polledAt) && polledAt - (quote.lastTradeAt ?? quote.at) < 60_000;
  const intervalName = INTERVAL_CHOICES.find(([value]) => value === barInterval)?.[2] ?? barInterval;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <Choice label="Index" value={underlying} options={UNDERLYING_ORDER.map((name) => [name, UNDERLYINGS[name].contractName] as const)} onChange={chooseUnderlying} />
        {data && data.expiries.length > 0 && (
          <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Expiry
            <select value={data.expiry ?? ""} onChange={(event) => chooseExpiry(event.target.value)} className={`${selectClass} block`}>
              {data.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiryLabel(expiry)}</option>)}
            </select>
          </label>
        )}
        <div className="sm:ml-auto">
          <Choice label="Candle interval" value={barInterval} options={INTERVAL_CHOICES.map(([value, short]) => [value, short] as const)} onChange={setBarInterval} />
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {listError && !data && (
            <p role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">
              {listError}
              <button type="button" onClick={() => setReloads((count) => count + 1)} className="inline-flex items-center gap-1.5 text-xs underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button>
            </p>
          )}
          {!data && !listError && <div className="terminal-card flex h-[420px] items-center justify-center text-sm text-[var(--muted)]">Loading {UNDERLYINGS[underlying].contractName} options…</div>}
          {data && rows.length === 0 && <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No {UNDERLYINGS[underlying].contractName} options are listed today.</p>}

          {data && rows.length > 0 && (
            <section className="terminal-card overflow-hidden" aria-labelledby="chain-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h2 id="chain-title" className="text-sm font-medium">{UNDERLYINGS[underlying].contractName} option chain{data.expiry ? <span className="text-[var(--muted)]"> · {expiryLabel(data.expiry)}</span> : null}</h2>
                <p className="text-[11px] text-[var(--muted)]">Calls on the left, puts on the right. Shaded: in the money.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <caption className="sr-only">{UNDERLYINGS[underlying].contractName} calls and puts by strike, with buy and sell</caption>
                  <thead className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    <tr><th scope="col" className="hidden px-2 py-2 text-right font-normal sm:table-cell">OI</th><th scope="col" colSpan={2} className="px-2 py-2 text-right font-normal">Calls</th><th scope="col" className="px-2 py-2 text-center font-normal">Strike</th><th scope="col" colSpan={2} className="px-2 py-2 text-left font-normal">Puts</th><th scope="col" className="hidden px-2 py-2 text-left font-normal sm:table-cell">OI</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((row) => {
                      const callQuote = row.call ? quotes[quoteKey(row.call)] : undefined;
                      const putQuote = row.put ? quotes[quoteKey(row.put)] : undefined;
                      const isAtm = row.strike === atm && spot !== undefined;
                      const oi = (item: MarketQuote | undefined) => (item && item.oi !== null ? countText.format(item.oi) : "—");
                      return (
                        <tr key={row.strike} className={isAtm ? "bg-[var(--primary)]/5" : ""}>
                          <td className={`hidden px-2 py-1.5 text-right font-mono text-[var(--muted)] sm:table-cell ${spot !== undefined && row.strike < spot ? "bg-[var(--card-raised)]" : ""}`}>{oi(callQuote)}</td>
                          <ChainCell contract={row.call} quote={callQuote} side="CE" itm={spot !== undefined && row.strike < spot} selected={pick?.strike === row.strike && pick.right === "CE"} onSelect={() => select(row.strike, "CE")} onTrade={(value) => { select(row.strike, "CE"); trade(value); }} />
                          <th scope="row" className={`px-2 py-1.5 text-center font-mono text-sm font-medium ${isAtm ? "text-[var(--primary)]" : ""}`}>{strikeText.format(row.strike / 100)}{isAtm && <span className="block font-sans text-[9px] font-normal uppercase tracking-[0.12em]">ATM</span>}</th>
                          <ChainCell contract={row.put} quote={putQuote} side="PE" itm={spot !== undefined && row.strike > spot} selected={pick?.strike === row.strike && pick.right === "PE"} onSelect={() => select(row.strike, "PE")} onTrade={(value) => { select(row.strike, "PE"); trade(value); }} />
                          <td className={`hidden px-2 py-1.5 text-left font-mono text-[var(--muted)] sm:table-cell ${spot !== undefined && row.strike > spot ? "bg-[var(--card-raised)]" : ""}`}>{oi(putQuote)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {contract && (
            <section className="terminal-card overflow-hidden" aria-label={label ?? undefined}>
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-[var(--border)] px-4 py-4 sm:px-6">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{contract.tradingSymbol}</p>
                  <h2 className="mt-1 text-lg font-medium tracking-tight sm:text-xl">{label}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-3" aria-live="off">
                    <span className="font-mono text-3xl tracking-tight">{quote ? price(quote.lastPrice) : "—"}</span>
                    {quote && <Change quote={quote} className="text-sm" />}
                  </div>
                  <div className="flex gap-2" role="group" aria-label="Trade this option">
                    {(["BUY", "SELL"] as const).map((value) => (
                      <button key={value} type="button" onClick={() => trade(value)} className={`min-h-10 min-w-20 rounded-lg px-4 text-sm font-medium ${value === "BUY" ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]" : "bg-[var(--danger)] text-[#2a0f0a] hover:opacity-90"}`}>
                        {value === "BUY" ? "Buy" : "Sell"}
                      </button>
                    ))}
                  </div>
                </div>
                <dl className="grid w-full grid-cols-3 gap-x-6 gap-y-3 text-xs sm:grid-cols-6">
                  {[
                    ["Open", quote ? price(quote.open) : "—"],
                    ["High", quote ? price(quote.high) : "—"],
                    ["Low", quote ? price(quote.low) : "—"],
                    ["Prev close", quote ? price(quote.previousClose) : "—"],
                    ["Volume", quote ? countText.format(quote.volume) : "—"],
                    ["Open interest", quote && quote.oi !== null ? countText.format(quote.oi) : "—"],
                  ].map(([term, value]) => (
                    <div key={term}><dt className="text-[var(--muted)]">{term}</dt><dd className="mt-1 font-mono text-sm">{value}</dd></div>
                  ))}
                </dl>
                <p className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${fresh ? "bg-[var(--primary)]" : "bg-[var(--faint)]"}`} aria-hidden="true" />{fresh ? "Live" : polledAt !== null && !marketHours(polledAt) ? "Market closed" : "Waiting for prices"}</span>
                  {quote && <span>Last update {clockText.format(quote.lastTradeAt ?? quote.at)} IST</span>}
                  <span>Lot {contract.lotSize} · tick ₹{(contract.tickSize / 100).toFixed(2)}</span>
                  {quoteError && <span className="text-[var(--warning)]">{quoteError}</span>}
                </p>
              </div>

              <div className="relative px-1 pt-2 sm:px-2">
                <PriceChart candles={candles ?? NO_CANDLES} live={liveCandle} interval={barInterval} minMove={contract.tickSize / 100} derivative label={`${label}, ${intervalName} candles`} />
                {!candles && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0b0f0d]/60 text-sm text-[var(--muted)]">
                    {failed ? (
                      <span role="alert" className="flex flex-col items-center gap-3 px-6 text-center text-[var(--danger)]">
                        {failed}
                        <button type="button" onClick={() => setReloads((count) => count + 1)} className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)] underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button>
                      </span>
                    ) : "Loading candles…"}
                  </div>
                )}
              </div>

              {quote && (quote.bids.length > 0 || quote.asks.length > 0) && (
                <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
                  {([["Bids", quote.bids, "text-[var(--primary)]"], ["Offers", quote.asks, "text-[var(--danger)]"]] as const).map(([title, levels, tone]) => (
                    <table key={title} className="w-full bg-[var(--card-deep)] text-left font-mono text-xs">
                      <caption className="px-4 pb-1 pt-3 text-left font-sans text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{title}</caption>
                      <thead className="text-[var(--muted)]"><tr><th scope="col" className="px-4 py-1.5 font-normal">Price</th><th scope="col" className="px-4 py-1.5 text-right font-normal">Qty</th><th scope="col" className="px-4 py-1.5 text-right font-normal">Orders</th></tr></thead>
                      <tbody>
                        {levels.map((level) => (
                          <tr key={level.price}><td className={`px-4 py-1.5 ${tone}`}>{price(level.price)}</td><td className="px-4 py-1.5 text-right">{level.quantity.toLocaleString("en-IN")}</td><td className="px-4 py-1.5 text-right text-[var(--muted)]">{level.orders}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <div className="space-y-3 xl:sticky xl:top-24">
          {desk && account ? (
            <>
              {accounts && accounts.length > 1 && (
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Account
                  <select value={account.id} onChange={(event) => { const next = accounts.find((item) => item.id === event.target.value); if (next) router.push(next.href); }} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 font-mono text-xs normal-case tracking-normal text-[var(--foreground)]">
                    {accounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              )}
              <AccountTicket desk={desk} planLabel={account.planLabel} demo={account.demo} contract={contract} label={label} quote={quote} side={side} onSide={setSide} onPlace={sendOrder} />
            </>
          ) : (
            <OpenEvaluation />
          )}
        </div>
      </div>
      {desk && <AccountBlotter desk={desk} onCancel={cancelOrder} onPlace={sendOrder} onModify={modifyOrder} />}
    </div>
  );
}
