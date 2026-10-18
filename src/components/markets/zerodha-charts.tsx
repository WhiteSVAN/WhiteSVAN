"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PriceChart } from "@/components/markets/price-chart";
import { AccountBlotter, AccountTicket, type OrderInput } from "@/components/markets/account-panel";
import { foldTick, type Candle, type Interval, type LiveTick } from "@/lib/market-data/candles";
import type { Desk } from "@/lib/trading/desk";
import type { EngineOutput } from "@/lib/trading/engine";
import type { Underlying } from "@/lib/trading/instruments";
import { clockSeconds, toIst } from "@/lib/trading/time";
import { quoteKey, UNDERLYINGS, type InstrumentList, type KiteContract, type MarketQuote, type OptionStrike } from "@/lib/zerodha/kite";

type Mode = "index" | "future" | "option";

const UNDERLYING_ORDER: Underlying[] = ["NIFTY", "BANKNIFTY", "SENSEX"];
const INDEX_KEYS = UNDERLYING_ORDER.map((name) => UNDERLYINGS[name].indexKey);
const MODES: [Mode, string][] = [["index", "Index"], ["future", "Futures"], ["option", "Options"]];
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
  const name = UNDERLYINGS[contract.underlying].contractName;
  const day = expiryText.formatToParts(new Date(`${contract.expiry}T00:00:00Z`));
  const part = (type: string) => day.find((item) => item.type === type)?.value ?? "";
  const expiry = `${part("day")} ${part("month")}`;
  return contract.kind === "FUT" ? `${name} ${expiry} FUT` : `${name} ${expiry} ${strikeText.format((contract.strike ?? 0) / 100)} ${contract.kind}`;
}

/** Weekday trading hours with a few minutes either side; quotes poll faster then. */
function marketHours(at: number): boolean {
  const { weekday, second } = toIst(at);
  return weekday >= 1 && weekday <= 5 && second >= clockSeconds("09:10") && second < clockSeconds("15:35");
}

function nearestStrike(chain: readonly OptionStrike[], target: number | undefined): number | null {
  if (chain.length === 0) return null;
  if (target === undefined) return chain[Math.floor(chain.length / 2)].strike;
  return chain.reduce((best, row) => (Math.abs(row.strike - target) < Math.abs(best - target) ? row.strike : best), chain[0].strike);
}

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal, init?: { method: "POST" | "DELETE"; body?: unknown }): Promise<T> {
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

interface ChartInstrument {
  key: string;
  token: number;
  label: string;
  /** Smallest price step in paise. */
  tick: number;
  contract: KiteContract | null;
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

function SessionEnded({ message, loginHref }: { message: string; loginHref: string }) {
  return (
    <div className="terminal-card px-6 py-12 text-center">
      <h2 className="text-xl font-medium tracking-tight">Connect Zerodha again</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
      {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
      <a href={loginHref} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Log in with Zerodha</a>
    </div>
  );
}

/**
 * Charts, quotes and depth for NIFTY, BANK NIFTY and SENSEX from the owner's Kite session. With an
 * `account`, it is that evaluation account's trading platform: the order ticket and blotter, with
 * each poll feeding the account on the server.
 */
export function ZerodhaCharts({ account }: { account?: { id: string; desk: Desk; planLabel: string } }) {
  const [underlying, setUnderlying] = useState<Underlying>("NIFTY");
  const [mode, setMode] = useState<Mode>("index");
  const [barInterval, setBarInterval] = useState<Interval>("5minute");
  const [expiryChoice, setExpiryChoice] = useState<string | null>(null);
  const [futureToken, setFutureToken] = useState<number | null>(null);
  const [strike, setStrike] = useState<number | null>(null);
  /** False until the owner picks a strike; until then Options opens at the money. */
  const [strikePicked, setStrikePicked] = useState(false);
  const [right, setRight] = useState<"CE" | "PE">("CE");
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
  const home = account ? `/trade/${account.id}` : "/markets";
  // Kite's 06:00 logout or a revoked token: re-render the page from the server, which now offers a
  // fresh login (the API route has already dropped the cookie).
  const sessionEnded = useCallback((message: string) => {
    setEnded(message);
    router.replace(`${home}?zerodha=ended`);
  }, [router, home]);
  const latestQuotes = useRef<Record<string, MarketQuote>>({});
  const lastPoll = useRef(0);
  const [desk, setDesk] = useState<Desk | null>(account?.desk ?? null);
  const accountId = account?.id ?? null;

  const data = list?.underlying === underlying ? list : null;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ underlying });
    if (expiryChoice) query.set("expiry", expiryChoice);
    getJson<InstrumentList>(`/api/zerodha/instruments?${query}`, controller.signal)
      .then((next) => {
        setList(next);
        setListError(null);
        const atm = nearestStrike(next.chain, latestQuotes.current[next.index.key]?.lastPrice);
        setStrike((current) => (current !== null && next.chain.some((row) => row.strike === current) ? current : atm));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
        else setListError(error instanceof Error ? error.message : "Could not load Zerodha's contract list.");
      });
    return () => controller.abort();
  }, [underlying, expiryChoice, reloads, sessionEnded]);

  const instrument = useMemo((): ChartInstrument | null => {
    if (!data) return null;
    const fromContract = (contract: KiteContract): ChartInstrument => ({ key: quoteKey(contract), token: contract.token, label: contractLabel(contract), tick: contract.tickSize, contract });
    if (mode === "index") return { key: data.index.key, token: data.index.token, label: data.index.label, tick: 1, contract: null };
    if (mode === "future") {
      const contract = data.futures.find((item) => item.token === futureToken) ?? data.futures[0];
      return contract ? fromContract(contract) : null;
    }
    const row = data.chain.find((item) => item.strike === strike);
    const contract = row ? (right === "CE" ? row.call : row.put) : null;
    return contract ? fromContract(contract) : null;
  }, [data, mode, futureToken, strike, right]);

  const token = instrument?.token ?? null;
  const derivative = Boolean(instrument?.contract);
  const selectedKey = instrument?.key ?? null;
  const chartKey = token === null ? null : `${token}|${barInterval}`;
  const candles = history && history.key === chartKey ? history.candles : null;

  useEffect(() => {
    if (token === null) return;
    const key = `${token}|${barInterval}`;
    const controller = new AbortController();
    const query = new URLSearchParams({ token: String(token), interval: barInterval });
    if (derivative) query.set("oi", "1");
    getJson<{ candles: Candle[] }>(`/api/zerodha/candles?${query}`, controller.signal)
      .then((body) => setHistory({ key, candles: body.candles }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) sessionEnded(error.message);
        else setHistoryError({ key, message: error instanceof Error ? error.message : "Could not load candles." });
      });
    return () => controller.abort();
  }, [token, derivative, barInterval, reloads, sessionEnded]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous: LiveTick | null = null;
    let current: Candle | null = candles?.[candles.length - 1] ?? null;
    // One Kite call per poll: the charted contract, then the index cards. On an account the server
    // puts the account's own contracts first.
    const keys = [...new Set([...(selectedKey ? [selectedKey] : []), ...INDEX_KEYS])];
    const poll = async () => {
      let delay = marketHours(Date.now()) ? 2_000 : 20_000;
      if (!document.hidden) {
        lastPoll.current = Date.now();
        try {
          const body: { quotes: MarketQuote[]; desk?: Desk } = accountId
            ? await getJson(`/api/accounts/${accountId}/tick`, undefined, { method: "POST", body: { keys } })
            : await getJson(`/api/zerodha/quotes?${new URLSearchParams(keys.map((key) => ["i", key]))}`);
          if (stopped) return;
          if (body.desk) setDesk(body.desk);
          latestQuotes.current = { ...latestQuotes.current, ...Object.fromEntries(body.quotes.map((quote) => [quote.key, quote])) };
          setQuotes(latestQuotes.current);
          setPolledAt(Date.now());
          setQuoteError(null);
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
    // Kite allows one quote request a second, so a restart waits for the last poll's second to pass.
    timer = setTimeout(poll, Math.max(0, 1_100 - (Date.now() - lastPoll.current)));
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [selectedKey, accountId, chartKey, candles, barInterval, sessionEnded]);

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
  }, [accountId, sessionEnded]);
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!accountId) return;
    const body = await getJson<{ desk: Desk }>(`/api/accounts/${accountId}/orders/${encodeURIComponent(orderId)}`, undefined, { method: "DELETE" });
    setDesk(body.desk);
  }, [accountId]);

  const chooseUnderlying = (next: Underlying) => {
    if (next === underlying) return;
    setUnderlying(next);
    setExpiryChoice(null);
    setFutureToken(null);
    setStrike(null);
    setStrikePicked(false);
  };
  const chooseMode = (next: Mode) => {
    setMode(next);
    if (next === "option" && data && !strikePicked) setStrike(nearestStrike(data.chain, quotes[data.index.key]?.lastPrice));
  };

  if (ended) return <SessionEnded message={ended} loginHref={`/api/zerodha/login?${new URLSearchParams({ next: home })}`} />;

  const quote = selectedKey ? quotes[selectedKey] : undefined;
  const liveCandle = live && live.key === chartKey ? live.candle : null;
  const failed = historyError && historyError.key === chartKey ? historyError.message : null;
  const fresh = quote && polledAt !== null && marketHours(polledAt) && polledAt - (quote.lastTradeAt ?? quote.at) < 60_000;
  const intervalName = INTERVAL_CHOICES.find(([value]) => value === barInterval)?.[2] ?? barInterval;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {UNDERLYING_ORDER.map((name) => {
          const index = quotes[UNDERLYINGS[name].indexKey];
          const active = name === underlying;
          return (
            <button key={name} type="button" aria-pressed={active} onClick={() => chooseUnderlying(name)} className={`rounded-xl border px-4 py-3 text-left transition ${active ? "border-[var(--primary)] bg-[var(--card-raised)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"}`}>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{UNDERLYINGS[name].label}</span>
              <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-mono text-lg">{index ? price(index.lastPrice) : "—"}</span>
                {index && <Change quote={index} className="text-xs" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <Choice label="Contract" value={mode} options={MODES} onChange={chooseMode} />
        {mode === "future" && data && data.futures.length > 0 && (
          <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Expiry
            <select value={instrument?.token ?? ""} onChange={(event) => setFutureToken(Number(event.target.value))} className={`${selectClass} block`}>
              {data.futures.map((contract) => <option key={contract.token} value={contract.token}>{expiryLabel(contract.expiry)}</option>)}
            </select>
          </label>
        )}
        {mode === "option" && data && data.expiries.length > 0 && (
          <>
            <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Expiry
              <select value={data.expiry ?? ""} onChange={(event) => setExpiryChoice(event.target.value)} className={`${selectClass} block`}>
                {data.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiryLabel(expiry)}</option>)}
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Strike
              <select value={strike ?? ""} onChange={(event) => { setStrike(Number(event.target.value)); setStrikePicked(true); }} className={`${selectClass} block`}>
                {data.chain.map((row) => <option key={row.strike} value={row.strike}>{strikeText.format(row.strike / 100)}</option>)}
              </select>
            </label>
            <Choice label="Option type" value={right} options={[["CE", "Call"], ["PE", "Put"]] as const} onChange={setRight} />
          </>
        )}
        <div className="sm:ml-auto">
          <Choice label="Candle interval" value={barInterval} options={INTERVAL_CHOICES.map(([value, short]) => [value, short] as const)} onChange={setBarInterval} />
        </div>
      </div>

      <div className={`grid items-start gap-4 ${desk ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <div className="min-w-0 space-y-4">
          {listError && !data && (
            <p role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">
              {listError}
              <button type="button" onClick={() => setReloads((count) => count + 1)} className="inline-flex items-center gap-1.5 text-xs underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button>
            </p>
          )}
          {!data && !listError && <div className="terminal-card flex h-[420px] items-center justify-center text-sm text-[var(--muted)]">Loading {UNDERLYINGS[underlying].label} contracts…</div>}
          {data && !instrument && <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">Zerodha&apos;s contract list has no {mode === "future" ? "futures" : "options"} for {UNDERLYINGS[underlying].label} today.</p>}

          {instrument && (
            <section className="terminal-card overflow-hidden" aria-label={instrument.label}>
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-[var(--border)] px-4 py-4 sm:px-6">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{instrument.key}</p>
                  <h2 className="mt-1 text-lg font-medium tracking-tight sm:text-xl">{instrument.label}</h2>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3" aria-live="off">
                  <span className="font-mono text-3xl tracking-tight">{quote ? price(quote.lastPrice) : "—"}</span>
                  {quote && <Change quote={quote} className="text-sm" />}
                </div>
                <dl className="grid w-full grid-cols-3 gap-x-6 gap-y-3 text-xs sm:grid-cols-6">
                  {[
                    ["Open", quote ? price(quote.open) : "—"],
                    ["High", quote ? price(quote.high) : "—"],
                    ["Low", quote ? price(quote.low) : "—"],
                    ["Prev close", quote ? price(quote.previousClose) : "—"],
                    ...(instrument.contract
                      ? [["Volume", quote ? countText.format(quote.volume) : "—"], ["Open interest", quote && quote.oi !== null ? countText.format(quote.oi) : "—"]]
                      : []),
                  ].map(([term, value]) => (
                    <div key={term}><dt className="text-[var(--muted)]">{term}</dt><dd className="mt-1 font-mono text-sm">{value}</dd></div>
                  ))}
                </dl>
                <p className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${fresh ? "bg-[var(--primary)]" : "bg-[var(--faint)]"}`} aria-hidden="true" />{fresh ? "Live" : polledAt !== null && !marketHours(polledAt) ? "Market closed" : "Waiting for prices"}</span>
                  {quote && <span>Last update {clockText.format(quote.lastTradeAt ?? quote.at)} IST</span>}
                  {instrument.contract && <span>Lot {instrument.contract.lotSize} · tick ₹{(instrument.contract.tickSize / 100).toFixed(2)}</span>}
                  {quoteError && <span className="text-[var(--warning)]">{quoteError}</span>}
                </p>
              </div>

              <div className="relative px-1 pt-2 sm:px-2">
                <PriceChart key={derivative ? "fno" : "index"} candles={candles ?? NO_CANDLES} live={liveCandle} interval={barInterval} minMove={instrument.tick / 100} derivative={derivative} label={`${instrument.label}, ${intervalName} candles`} />
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

              {instrument.contract && quote && (quote.bids.length > 0 || quote.asks.length > 0) && (
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
        {desk && account && <AccountTicket desk={desk} planLabel={account.planLabel} contract={instrument?.contract ?? null} quote={quote} onPlace={sendOrder} />}
      </div>
      {desk && <AccountBlotter desk={desk} onCancel={cancelOrder} onPlace={sendOrder} />}
    </div>
  );
}
