import { describe, expect, it } from "vitest";
import { KiteError, type MarketQuote } from "./kite";
import { createGate, createQuoteBatcher, createSharedLoads, type Clock } from "./throttle";

/** A clock whose sleeps pass at once, moving time forward. */
function testClock() {
  let now = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
  return { clock, advance: (ms: number) => (now += ms) };
}

const quote = (key: string, lastPrice = 10_000): MarketQuote => ({
  key,
  token: 1,
  at: 0,
  lastTradeAt: null,
  lastPrice,
  previousClose: 0,
  open: 0,
  high: 0,
  low: 0,
  volume: 0,
  oi: null,
  bids: [],
  asks: [],
});

function batcherWith(options: { maxKeys?: number; fail?: () => boolean; skip?: (key: string) => boolean } = {}) {
  const { clock, advance } = testClock();
  const calls: { at: number; keys: string[] }[] = [];
  const quotes = createQuoteBatcher({
    load: async (keys) => {
      calls.push({ at: clock.now(), keys });
      if (options.fail?.()) throw new KiteError("Zerodha could not be reached.", 504, "NetworkException");
      return keys.filter((key) => !options.skip?.(key)).map((key) => quote(key));
    },
    gate: createGate(1_000, 4, clock),
    freshMs: 1_000,
    maxKeys: options.maxKeys ?? 500,
    clock,
  });
  return { quotes, calls, advance };
}

const keysOf = (list: MarketQuote[]) => list.map((item) => item.key);

describe("Kite gate", () => {
  it("runs one call at a time, a gap apart", async () => {
    const { clock } = testClock();
    const gate = createGate(1_000, 5, clock);
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => gate(async () => starts.push(clock.now()))));
    expect(starts).toEqual([0, 1_000, 2_000]);
  });

  it("turns a request away with a 429 when the queue is full", async () => {
    const gate = createGate(1_000, 2, testClock().clock);
    const results = await Promise.allSettled([gate(async () => "a"), gate(async () => "b"), gate(async () => "c")]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "rejected"]);
    expect((results[2] as PromiseRejectedResult).reason).toMatchObject({ status: 429, errorType: "RateLimitException" });
  });

  it("keeps going after a failed call", async () => {
    const gate = createGate(1_000, 5, testClock().clock);
    await expect(gate(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(gate(async () => "next")).resolves.toBe("next");
  });
});

describe("Shared quotes", () => {
  it("sends the screens polling together as one Kite call", async () => {
    const { quotes, calls } = batcherWith();
    const [nifty, sensex] = await Promise.all([quotes(["NSE:NIFTY 50", "NFO:NIFTY26OCTFUT"]), quotes(["NSE:NIFTY 50", "BSE:SENSEX"])]);
    expect(calls).toEqual([{ at: 0, keys: ["NSE:NIFTY 50", "NFO:NIFTY26OCTFUT", "BSE:SENSEX"] }]);
    expect(keysOf(nifty)).toEqual(["NSE:NIFTY 50", "NFO:NIFTY26OCTFUT"]);
    expect(keysOf(sensex)).toEqual(["NSE:NIFTY 50", "BSE:SENSEX"]);
  });

  it("serves a quote under a second old from memory", async () => {
    const { quotes, calls, advance } = batcherWith();
    await quotes(["NSE:NIFTY 50"]);
    advance(600);
    expect(keysOf(await quotes(["NSE:NIFTY 50"]))).toEqual(["NSE:NIFTY 50"]);
    expect(calls).toHaveLength(1);
    advance(600);
    await quotes(["NSE:NIFTY 50"]);
    expect(calls).toHaveLength(2);
  });

  it("waits out Kite's second before the next call", async () => {
    const { quotes, calls } = batcherWith();
    await quotes(["NSE:NIFTY 50"]);
    expect(keysOf(await quotes(["NSE:NIFTY 50", "BSE:SENSEX"]))).toEqual(["NSE:NIFTY 50", "BSE:SENSEX"]);
    expect(calls).toEqual([
      { at: 0, keys: ["NSE:NIFTY 50"] },
      { at: 1_000, keys: ["NSE:NIFTY 50", "BSE:SENSEX"] },
    ]);
  });

  it("splits more keys than one call takes", async () => {
    const { quotes, calls } = batcherWith({ maxKeys: 2 });
    const [first, second] = await Promise.all([quotes(["A:1", "A:2"]), quotes(["A:3"])]);
    expect(calls.map((call) => call.keys)).toEqual([["A:1", "A:2"], ["A:3"]]);
    expect(keysOf(first)).toEqual(["A:1", "A:2"]);
    expect(keysOf(second)).toEqual(["A:3"]);
  });

  it("fails the waiting screens together and tries again on the next poll", async () => {
    let down = true;
    const { quotes, advance } = batcherWith({ fail: () => down });
    const results = await Promise.allSettled([quotes(["NSE:NIFTY 50"]), quotes(["BSE:SENSEX"])]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    down = false;
    advance(1_000);
    expect(keysOf(await quotes(["NSE:NIFTY 50"]))).toEqual(["NSE:NIFTY 50"]);
  });

  it("never passes an old quote off as new when Kite stops returning a key", async () => {
    let known = true;
    const { quotes, advance } = batcherWith({ skip: () => !known });
    expect(await quotes(["NFO:EXPIRED"])).toHaveLength(1);
    known = false;
    advance(2_000);
    expect(await quotes(["NFO:EXPIRED"])).toEqual([]);
  });
});

describe("Shared loads", () => {
  it("shares one load between screens and keeps it for a while", async () => {
    const { clock, advance } = testClock();
    const shared = createSharedLoads<number>(clock);
    let loads = 0;
    const load = async () => ++loads;
    expect(await Promise.all([shared("NIFTY|5minute", 15_000, load), shared("NIFTY|5minute", 15_000, load)])).toEqual([1, 1]);
    advance(14_000);
    expect(await shared("NIFTY|5minute", 15_000, load)).toBe(1);
    expect(await shared("NIFTY|day", 15_000, load)).toBe(2);
    advance(1_000);
    expect(await shared("NIFTY|5minute", 15_000, load)).toBe(3);
  });

  it("doesn't keep a failed load", async () => {
    const shared = createSharedLoads<string>(testClock().clock);
    await expect(shared("key", 15_000, async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    await expect(shared("key", 15_000, async () => "candles")).resolves.toBe("candles");
  });
});
