/**
 * One Kite login serves every signed-in user, and Kite allows a login 1 quote request and 3
 * historical requests a second. So calls queue through a gate, quote requests that arrive together
 * go out as one Kite call, and recent results are reused. Pure apart from the clock, which tests
 * replace. The limits hold per server instance; a 429 from another instance makes screens retry.
 */
import { KiteError, type MarketQuote } from "./kite";

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type Gate = <T>(task: () => Promise<T>) => Promise<T>;

/** Results are dropped this long after they were fetched. */
const KEEP_MS = 60_000;

const busy = () => new KiteError("The price feed is busy. Retrying shortly.", 429, "RateLimitException");

/**
 * Runs tasks one at a time, each starting at least `gapMs` after the previous one started. With
 * `maxQueue` tasks already waiting, a new one fails at once with a 429.
 */
export function createGate(gapMs: number, maxQueue: number, clock: Clock = systemClock): Gate {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;
  let waiting = 0;
  return <T>(task: () => Promise<T>): Promise<T> => {
    if (waiting >= maxQueue) return Promise.reject(busy());
    waiting += 1;
    const run = tail.then(async () => {
      const wait = lastStart + gapMs - clock.now();
      if (wait > 0) await clock.sleep(wait);
      waiting -= 1;
      lastStart = clock.now();
      return task();
    });
    tail = run.catch(() => undefined);
    return run;
  };
}

export interface QuoteBatcherOptions {
  /** One Kite /quote call. */
  load: (keys: string[]) => Promise<MarketQuote[]>;
  gate: Gate;
  /** A quote fetched this recently is served from memory. */
  freshMs: number;
  /** Most keys in one call (Kite takes 500). */
  maxKeys: number;
  clock?: Clock;
}

interface Waiter {
  keys: readonly string[];
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Quotes for many screens through one login. Keys asked for while a call waits at the gate join
 * that call, so the screens polling in one second cost one Kite request between them.
 */
export function createQuoteBatcher({ load, gate, freshMs, maxKeys, clock = systemClock }: QuoteBatcherOptions) {
  const cache = new Map<string, { quote: MarketQuote; at: number }>();
  let waiting: Waiter[] = [];
  let queued = false;

  const fresh = (key: string, at: number) => {
    const hit = cache.get(key);
    return hit !== undefined && at - hit.at < freshMs;
  };

  const queue = () => {
    if (queued || waiting.length === 0) return;
    queued = true;
    gate(flush).catch((error: unknown) => {
      // Only a full gate lands here; flush settles its own waiters.
      queued = false;
      const failed = waiting;
      waiting = [];
      for (const waiter of failed) waiter.reject(error);
    });
  };

  async function flush(): Promise<void> {
    queued = false;
    const at = clock.now();
    const keys = [...new Set(waiting.flatMap((waiter) => waiter.keys))].filter((key) => !fresh(key, at)).slice(0, maxKeys);
    const asked = new Set(keys);
    // Waiters with a key that didn't fit stay for the next call.
    const ready = waiting.filter((waiter) => waiter.keys.every((key) => asked.has(key) || fresh(key, at)));
    waiting = waiting.filter((waiter) => !ready.includes(waiter));
    try {
      if (keys.length > 0) {
        const quotes = await load(keys);
        const fetchedAt = clock.now();
        for (const quote of quotes) cache.set(quote.key, { quote, at: fetchedAt });
      }
      for (const waiter of ready) waiter.resolve();
    } catch (error) {
      for (const waiter of ready) waiter.reject(error);
    } finally {
      const now = clock.now();
      for (const [key, hit] of cache) if (now - hit.at > KEEP_MS) cache.delete(key);
      queue();
    }
  }

  return async function quotes(keys: readonly string[]): Promise<MarketQuote[]> {
    const start = clock.now();
    if (keys.some((key) => !fresh(key, start))) {
      await new Promise<void>((resolve, reject) => {
        waiting.push({ keys, resolve, reject });
        queue();
      });
    }
    // What the call returned, and what was fresh when the request arrived; Kite skips unknown keys.
    return keys.flatMap((key) => {
      const hit = cache.get(key);
      return hit && start - hit.at < freshMs ? [hit.quote] : [];
    });
  };
}

/**
 * One load per key at a time, its result reused for `keepMs` from when it started (chart history:
 * the screens that open a chart together share one fetch). A failed load isn't kept.
 */
export function createSharedLoads<T>(clock: Clock = systemClock) {
  const entries = new Map<string, { until: number; value: Promise<T> }>();
  return (key: string, keepMs: number, load: () => Promise<T>): Promise<T> => {
    const now = clock.now();
    const hit = entries.get(key);
    if (hit && hit.until > now) return hit.value;
    for (const [other, entry] of entries) if (entry.until <= now) entries.delete(other);
    const value = load();
    entries.set(key, { until: now + keepMs, value });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}
