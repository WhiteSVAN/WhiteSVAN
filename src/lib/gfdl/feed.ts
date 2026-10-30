/**
 * The Global Datafeeds connection (server only): one WebSocket per server instance, authenticated
 * with GFDL_API_KEY. Requests (instrument lists, candles) wait for their reply; quotes come from
 * SubscribeRealtime pushes (about one a second per contract that changes), kept in memory, so
 * screens polling cost no calls; a contract's first quote is a GetLastQuoteArray snapshot. Contracts load on demand: an underlying's expiry list, then each expiry's options the first time a screen asks. The trial allows 1,800 calls an hour and 100 subscribed contracts: the contracts
 * no screen has asked for longest are unsubscribed past that.
 */
import type { Candle, Interval } from "@/lib/market-data/candles";
import type { Underlying } from "@/lib/trading/instruments";
import { logger } from "@/lib/logger";
import { toIst } from "@/lib/trading/time";
import { createSharedLoads } from "@/lib/zerodha/throttle";
import { KiteError, UNDERLYINGS, quoteKey, type DerivativesExchange, type MarketQuote } from "@/lib/zerodha/kite";
import type { GfdlConfig } from "./config";
import { expiriesRequest, GFDL_INDEX, gfdlDate, gfdlQuote, historyRequest, indexUnderlying, instrumentsRequest, isObject, nearestExpiries, parseGfdlCandles, parseGfdlContracts, results, symbolExpiry, type GfdlContract } from "./gfdl";

const CONNECT_MS = 10_000;
const REPLY_MS = 15_000;
/** Below the trial's 100, for headroom while unsubscribing. */
const MAX_SUBSCRIBED = 95;
/** How long a quote call waits for the first push of a contract it just subscribed. */
const FIRST_PUSH_MS = 1_500;
/** Expiries the chain offers per underlying. */
const EXPIRIES_LISTED = 8;
/** How many of the nearest expiries a token nobody has loaded yet is looked for in. */
const TOKEN_SEARCH_EXPIRIES = 4;
/** GetLastQuoteArray takes up to 25 contracts. */
const SNAPSHOT_MAX = 25;
const HISTORY_KEEP_MS = 15_000;
const DAY_HISTORY_KEEP_MS = 60_000;

type Json = Record<string, unknown>;

interface Pending {
  matches: (message: Json) => boolean;
  resolve: (message: Json) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Subscription {
  exchange: DerivativesExchange;
  /** When a screen last asked for it. */
  wantedAt: number;
}

interface Feed {
  socket: WebSocket | null;
  ready: Promise<WebSocket> | null;
  pending: Pending[];
  /** Latest push per GFDL identifier, with when it arrived. */
  quotes: Map<string, { raw: Json; at: number }>;
  /** When the connection last sent anything (its heartbeat comes every 2 seconds). */
  heardAt: number;
  subscribed: Map<string, Subscription>;
  /** Expiries by underlying and IST date, and options by underlying and expiry, as they load. */
  expiryLists: Map<string, Promise<string[]>>;
  chains: Map<string, Promise<GfdlContract[]>>;
  byKey: Map<string, GfdlContract>;
  byToken: Map<number, GfdlContract>;
  exchanges: Promise<Set<string>> | null;
  history: ReturnType<typeof createSharedLoads<Candle[]>>;
}

// On globalThis so every route in a server process shares one connection, however it was bundled.
const shared = globalThis as unknown as { gfdlFeedV2?: Feed };
const feed: Feed = (shared.gfdlFeedV2 ??= {
  socket: null,
  ready: null,
  pending: [],
  quotes: new Map(),
  heardAt: 0,
  subscribed: new Map(),
  expiryLists: new Map(),
  chains: new Map(),
  byKey: new Map(),
  byToken: new Map(),
  exchanges: null,
  history: createSharedLoads<Candle[]>(),
});

const offline = (message = "The price feed could not be reached.") => new KiteError(message, 504, "NetworkException");

function subscribeMessage(identifier: string, exchange: DerivativesExchange, unsubscribe = false) {
  return JSON.stringify({ MessageType: "SubscribeRealtime", Exchange: exchange, Unsubscribe: unsubscribe ? "true" : "false", InstrumentIdentifier: identifier });
}

/** A pushed or snapshot quote, unless a newer one is already in. */
function keepQuote(raw: Json) {
  if (typeof raw.InstrumentIdentifier !== "string") return;
  const known = feed.quotes.get(raw.InstrumentIdentifier);
  if (known && Number(known.raw.ServerTime) > Number(raw.ServerTime)) return;
  feed.quotes.set(raw.InstrumentIdentifier, { raw, at: Date.now() });
}

function onMessage(data: unknown) {
  let message: unknown;
  try {
    message = JSON.parse(String(data));
  } catch {
    return;
  }
  if (!isObject(message)) return;
  const type = message.MessageType;
  if (type === "RealtimeResult") return keepQuote(message);
  if (type === "LastQuoteArrayResult" && Array.isArray(message.Result)) message.Result.filter(isObject).forEach(keepQuote);
  if (type === "RequestError") {
    // Such as "Access Denied. Key already in use by other session.": a key serves one connection at a time.
    logger.error("gfdl.request_error", { message: typeof message.Message === "string" ? message.Message : null });
    if (typeof message.Message === "string" && /already in use/i.test(message.Message)) feed.socket?.close();
    const failed = feed.pending.shift();
    if (failed) {
      clearTimeout(failed.timer);
      failed.reject(new KiteError(`The price feed refused a request${typeof message.Message === "string" ? `: ${message.Message}` : "."}`, 502, "GfdlRequestError"));
    }
    return;
  }
  const index = feed.pending.findIndex((item) => item.matches(message));
  if (index < 0) return;
  const [pending] = feed.pending.splice(index, 1);
  clearTimeout(pending.timer);
  pending.resolve(message);
}

/** The open, authenticated connection; connects (and re-subscribes) when there is none. */
function connect(config: GfdlConfig): Promise<WebSocket> {
  if (feed.ready && feed.socket && feed.socket.readyState <= WebSocket.OPEN) return feed.ready;
  const ready = new Promise<WebSocket>((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(config.url);
    } catch {
      reject(offline());
      return;
    }
    feed.socket = socket;
    let authenticated = false;
    const timer = setTimeout(() => {
      reject(offline("The price feed did not answer."));
      socket.close();
    }, CONNECT_MS);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ MessageType: "Authenticate", Password: config.apiKey })));
    socket.addEventListener("message", (event) => {
      feed.heardAt = Date.now();
      if (authenticated) return onMessage(event.data);
      let message: unknown = null;
      try {
        message = JSON.parse(String(event.data));
      } catch {}
      if (isObject(message) && message.MessageType === "RequestError") {
        clearTimeout(timer);
        reject(new KiteError(`The price feed is busy${typeof message.Message === "string" ? `: ${message.Message}` : "."}`, 429, "GfdlBusy"));
        socket.close();
        return;
      }
      if (!isObject(message) || message.MessageType !== "AuthenticateResult") return;
      clearTimeout(timer);
      if (message.Complete !== true) {
        reject(new KiteError(`The price feed refused the key${typeof message.Message === "string" ? `: ${message.Message}` : "."}`, 502, "GfdlKeyRejected"));
        socket.close();
        return;
      }
      authenticated = true;
      for (const [identifier, item] of feed.subscribed) socket.send(subscribeMessage(identifier, item.exchange));
      resolve(socket);
    });
    socket.addEventListener("close", () => {
      clearTimeout(timer);
      reject(offline());
      if (feed.socket !== socket) return;
      feed.socket = null;
      feed.ready = null;
      feed.quotes.clear();
      for (const item of feed.pending.splice(0)) {
        clearTimeout(item.timer);
        item.reject(offline("The price feed connection closed."));
      }
    });
  });
  feed.ready = ready;
  ready.catch(() => {
    if (feed.ready === ready) feed.ready = null;
  });
  return ready;
}

/** Send a request and wait for the reply `matches` picks out. */
async function request(config: GfdlConfig, body: Json, matches: (message: Json) => boolean): Promise<Json> {
  const socket = await connect(config);
  return new Promise<Json>((resolve, reject) => {
    const timer = setTimeout(() => {
      feed.pending = feed.pending.filter((item) => item.timer !== timer);
      reject(offline("The price feed took too long to answer."));
    }, REPLY_MS);
    feed.pending.push({ matches, resolve, reject, timer });
    socket.send(JSON.stringify(body));
  });
}

/** A reply of `type` whose echoed request matches `body` on `fields`. */
const replyTo = (type: string, body: Json, fields: readonly string[]) => (message: Json) =>
  message.MessageType === type && isObject(message.Request) && fields.every((field) => String((message.Request as Json)[field]) === String(body[field]));

/** The exchanges this key may read (the trial: BFO only). */
function allowedExchanges(config: GfdlConfig): Promise<Set<string>> {
  feed.exchanges ??= request(config, { MessageType: "GetExchanges" }, (message) => message.MessageType === "ExchangesResult")
    .then((body) => new Set(results(body, "exchanges").map((row) => String(row.Value))))
    .catch((error: unknown) => {
      feed.exchanges = null;
      throw error;
    });
  return feed.exchanges;
}

/** An underlying's option expiries from today, nearest first, in GFDL's spelling (`05NOV2026`); none when the key can't read its exchange. */
function expiryList(config: GfdlConfig, underlying: Underlying, now: number): Promise<string[]> {
  const today = toIst(now).date;
  const key = `${underlying}:${today}`;
  const cached = feed.expiryLists.get(key);
  if (cached) return cached;
  const exchange = UNDERLYINGS[underlying].exchange;
  const loading = (async () => {
    if (!(await allowedExchanges(config)).has(exchange)) return [];
    const asked = expiriesRequest(exchange, underlying);
    return nearestExpiries(await request(config, asked, replyTo("ExpiryDatesResult", asked, ["Exchange", "Product"])), today, EXPIRIES_LISTED);
  })();
  feed.expiryLists.set(key, loading);
  loading.catch(() => feed.expiryLists.delete(key));
  return loading;
}

/** One expiry's options for an underlying, loaded the first time anything asks for them. */
function expiryContracts(config: GfdlConfig, underlying: Underlying, expiry: string): Promise<GfdlContract[]> {
  const key = `${underlying}:${expiry}`;
  const cached = feed.chains.get(key);
  if (cached) return cached;
  const exchange = UNDERLYINGS[underlying].exchange;
  const loading = (async () => {
    const body = instrumentsRequest(exchange, underlying, expiry);
    const contracts = parseGfdlContracts(await request(config, body, replyTo("InstrumentsResult", body, ["Exchange", "Product", "Expiry"])), exchange, underlying);
    for (const contract of contracts) {
      feed.byKey.set(quoteKey(contract), contract);
      feed.byToken.set(contract.token, contract);
    }
    return contracts;
  })();
  feed.chains.set(key, loading);
  loading.catch(() => feed.chains.delete(key));
  return loading;
}

/** An underlying's expiries (IST dates) and the options of one: `asked` when it is listed, else the nearest. */
export async function gfdlChain(config: GfdlConfig, underlying: Underlying, asked: string | null, now: number): Promise<{ expiries: string[]; expiry: string | null; contracts: GfdlContract[] }> {
  const list = await expiryList(config, underlying, now);
  const dates = list.map(gfdlDate);
  const pick = list[Math.max(0, asked ? dates.indexOf(asked) : 0)];
  return { expiries: dates, expiry: pick ? gfdlDate(pick) : null, contracts: pick ? await expiryContracts(config, underlying, pick) : [] };
}

/** For keys this instance hasn't seen, load the expiries they name (a trading symbol carries its expiry). */
async function resolveKeys(config: GfdlConfig, keys: readonly string[], now: number) {
  const loads = new Map<string, Promise<GfdlContract[]>>();
  for (const key of keys) {
    if (!/^(?:NFO|BFO):/.test(key) || feed.byKey.has(key)) continue;
    const named = symbolExpiry(key.slice(4));
    if (!named) continue;
    const list = await expiryList(config, named.underlying, now);
    const expiry = named.date ? list.find((item) => gfdlDate(item) === named.date) : list.filter((item) => gfdlDate(item).startsWith(named.month)).at(-1);
    if (expiry && !loads.has(`${named.underlying}:${expiry}`)) loads.set(`${named.underlying}:${expiry}`, expiryContracts(config, named.underlying, expiry));
  }
  await Promise.all(loads.values());
}

/** The option with this token: from what this instance has loaded, else from the nearest expiries, one at a time. */
export async function gfdlContractForToken(config: GfdlConfig, token: number, now: number): Promise<GfdlContract | null> {
  const known = feed.byToken.get(token);
  if (known) return known;
  for (const underlying of Object.keys(UNDERLYINGS) as Underlying[]) {
    for (const expiry of (await expiryList(config, underlying, now)).slice(0, TOKEN_SEARCH_EXPIRIES)) {
      await expiryContracts(config, underlying, expiry);
      const found = feed.byToken.get(token);
      if (found) return found;
    }
  }
  return null;
}

export const gfdlIndexToken = (underlying: Underlying): number => GFDL_INDEX[underlying].token;

/** What a quote key or token reads from GFDL: an index's stand-in future, or an option. */
interface Target {
  key: string;
  token: number;
  identifier: string;
  exchange: DerivativesExchange;
  index: boolean;
}

function indexTarget(underlying: Underlying): Target {
  const { identifier, token } = GFDL_INDEX[underlying];
  return { key: UNDERLYINGS[underlying].indexKey, token, identifier, exchange: UNDERLYINGS[underlying].exchange, index: true };
}

const contractTarget = (contract: GfdlContract): Target => ({ key: quoteKey(contract), token: contract.token, identifier: contract.identifier, exchange: contract.exchange, index: false });

/** Subscribe what isn't yet; returns those. */
function subscribe(socket: WebSocket, targets: readonly Target[], now: number): Target[] {
  const added = targets.filter((target) => !feed.subscribed.has(target.identifier));
  for (const target of added) socket.send(subscribeMessage(target.identifier, target.exchange));
  for (const target of targets) feed.subscribed.set(target.identifier, { exchange: target.exchange, wantedAt: now });
  if (feed.subscribed.size <= MAX_SUBSCRIBED) return added;
  const oldest = [...feed.subscribed.entries()].sort((a, b) => a[1].wantedAt - b[1].wantedAt).slice(0, feed.subscribed.size - MAX_SUBSCRIBED);
  for (const [identifier, item] of oldest) {
    socket.send(subscribeMessage(identifier, item.exchange, true));
    feed.subscribed.delete(identifier);
    feed.quotes.delete(identifier);
  }
  return added;
}

/** Current quotes for contracts just subscribed, ahead of their first push (an illiquid one may not push for a while). */
async function snapshot(config: GfdlConfig, targets: readonly Target[]) {
  const byExchange = new Map<DerivativesExchange, Target[]>();
  for (const target of targets) byExchange.set(target.exchange, [...(byExchange.get(target.exchange) ?? []), target]);
  const calls: Promise<Json>[] = [];
  for (const [exchange, list] of byExchange) {
    for (let start = 0; start < list.length; start += SNAPSHOT_MAX) {
      const wanted = list.slice(start, start + SNAPSHOT_MAX).map((target) => target.identifier);
      const body = { MessageType: "GetLastQuoteArray", Exchange: exchange, isShortIdentifiers: "false", InstrumentIdentifiers: wanted.map((value) => ({ Value: value })) };
      const asked = new Set(wanted);
      calls.push(request(config, body, (message) => message.MessageType === "LastQuoteArrayResult" && Array.isArray(message.Result) && message.Result.every((row) => isObject(row) && asked.has(String(row.InstrumentIdentifier)))));
    }
  }
  await Promise.allSettled(calls);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Quotes for Kite-style keys (`BFO:SENSEX26N0575000CE`, `BSE:SENSEX`); keys the feed doesn't carry are left out. */
export async function gfdlQuotes(config: GfdlConfig, keys: readonly string[]): Promise<MarketQuote[]> {
  const now = Date.now();
  await resolveKeys(config, keys, now);
  const allowed = await allowedExchanges(config);
  const targets: Target[] = [];
  for (const key of keys) {
    const underlying = indexUnderlying(key);
    const contract = feed.byKey.get(key);
    const target = underlying ? indexTarget(underlying) : contract ? contractTarget(contract) : null;
    if (target && allowed.has(target.exchange)) targets.push(target);
  }
  const socket = await connect(config);
  // Let pushes that queued while this instance was idle land first.
  await sleep(10);
  const added = subscribe(socket, targets, now);
  if (added.length > 0) await Promise.race([snapshot(config, added), sleep(FIRST_PUSH_MS)]);
  // A subscribed contract's last push is its current price while the connection is alive.
  const alive = feed.socket?.readyState === WebSocket.OPEN ? feed.heardAt : 0;
  return targets.flatMap((target) => {
    const latest = feed.quotes.get(target.identifier);
    return latest ? [gfdlQuote(latest.raw, target.key, target.token, target.index, Math.max(latest.at, alive))] : [];
  });
}

/** The interval's lookback of candles up to `now`; screens opening the same chart within seconds share one request. */
export async function gfdlCandles(config: GfdlConfig, token: number, interval: Interval, withOi: boolean, now: number): Promise<Candle[]> {
  const underlying = (Object.keys(GFDL_INDEX) as Underlying[]).find((name) => GFDL_INDEX[name].token === token);
  const contract = underlying ? null : await gfdlContractForToken(config, token, now);
  const target = underlying ? indexTarget(underlying) : contract ? contractTarget(contract) : null;
  if (!target || !(await allowedExchanges(config)).has(target.exchange)) {
    throw new KiteError("This price feed doesn't carry that contract yet.", 400, "InputException");
  }
  const key = `${token}|${interval}|${withOi ? "oi" : ""}`;
  return feed.history(key, interval === "day" ? DAY_HISTORY_KEEP_MS : HISTORY_KEEP_MS, async () => {
    const body = historyRequest(target.exchange, target.identifier, interval, now);
    const reply = await request(config, body, replyTo("HistoryOHLCResult", body, ["InstrumentIdentifier", "Periodicity", "Period", "From"]));
    return parseGfdlCandles(reply, interval, withOi && !target.index);
  });
}
