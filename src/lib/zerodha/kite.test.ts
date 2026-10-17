import { describe, expect, it } from "vitest";
import { bookFrom, walkBook } from "@/lib/trading/matching";
import { ist } from "@/lib/trading/time";
import {
  contractsFor,
  historicalPath,
  historicalRanges,
  isQuoteKey,
  KiteError,
  kiteDateTime,
  kiteTime,
  loginUrl,
  mergeCandles,
  parseCandles,
  parseContracts,
  parseLogin,
  parseLtpTokens,
  parseQuotes,
  quoteKey,
  toEngineQuote,
} from "./kite";

const DAY = 86_400_000;

describe("Kite login", () => {
  it("builds the v3 login URL and carries the state in redirect_params", () => {
    expect(loginUrl("abc123", "f00d")).toBe("https://kite.zerodha.com/connect/login?v=3&api_key=abc123&redirect_params=state%3Df00d");
  });

  it("reads the session token response", () => {
    const body = { status: "success", data: { user_id: "AB1234", user_name: "Owner Name", access_token: "tok", public_token: "pub" } };
    expect(parseLogin(body)).toEqual({ userId: "AB1234", userName: "Owner Name", accessToken: "tok" });
    expect(() => parseLogin({ status: "success", data: { user_id: "AB1234" } })).toThrow(KiteError);
  });

  it("turns Kite's error envelope into a KiteError that knows when the session ended", () => {
    const expired = { status: "error", message: "Incorrect `api_key` or `access_token`.", error_type: "TokenException" };
    try {
      parseCandles(expired);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(KiteError);
      expect((error as KiteError).errorType).toBe("TokenException");
      expect((error as KiteError).sessionEnded).toBe(true);
    }
    expect(new KiteError("Too many requests", 429, "GeneralException").sessionEnded).toBe(false);
    expect(new KiteError("Forbidden", 403, "GeneralException").sessionEnded).toBe(true);
  });
});

describe("Kite times", () => {
  it("reads candle times with an offset and quote times in IST", () => {
    expect(kiteTime("2017-12-15T09:15:00+0530")).toBe(ist("2017-12-15 09:15"));
    expect(kiteTime("2017-12-15T09:15:00+05:30")).toBe(ist("2017-12-15 09:15"));
    expect(kiteTime("2017-12-15T03:45:00+0000")).toBe(ist("2017-12-15 09:15"));
    expect(kiteTime("2026-10-16 15:29:59")).toBe(ist("2026-10-16 15:29:59"));
    expect(() => kiteTime("16/10/2026")).toThrow(KiteError);
    expect(() => kiteTime(null)).toThrow(KiteError);
  });

  it("writes from/to as IST wall-clock time", () => {
    expect(kiteDateTime(ist("2026-10-16 09:15:05"))).toBe("2026-10-16 09:15:05");
    expect(kiteDateTime(ist("2026-10-16 00:00"))).toBe("2026-10-16 00:00:00");
  });
});

describe("historical candles", () => {
  it("builds the request path, with open interest when asked", () => {
    expect(historicalPath(5633, "minute", ist("2017-12-15 09:15"), ist("2017-12-15 09:20"), false)).toBe(
      "/instruments/historical/5633/minute?from=2017-12-15+09%3A15%3A00&to=2017-12-15+09%3A20%3A00",
    );
    expect(historicalPath(5633, "day", ist("2017-12-15 00:00"), ist("2017-12-20 00:00"), true)).toMatch(/&oi=1$/);
  });

  it("splits long ranges into Kite-sized requests", () => {
    const from = ist("2026-01-01 00:00");
    expect(historicalRanges(from, from + 150 * DAY, "minute")).toEqual([
      [from, from + 60 * DAY],
      [from + 60 * DAY, from + 120 * DAY],
      [from + 120 * DAY, from + 150 * DAY],
    ]);
    expect(historicalRanges(from, from + 730 * DAY, "day")).toEqual([[from, from + 730 * DAY]]);
    expect(historicalRanges(from, from, "day")).toEqual([]);
  });

  it("parses candles to paise, with and without open interest", () => {
    const plain = parseCandles({ status: "success", data: { candles: [["2017-12-15T09:15:00+0530", 1704.5, 1705, 1699.25, 1702.8, 2499]] } });
    expect(plain).toEqual([{ at: ist("2017-12-15 09:15"), open: 170_450, high: 170_500, low: 169_925, close: 170_280, volume: 2_499, oi: null }]);
    const withOi = parseCandles({ status: "success", data: { candles: [["2019-12-04T09:15:00+0530", 12009.9, 12019.35, 12001.25, 12001.5, 163275, 13667775]] } });
    expect(withOi[0]).toMatchObject({ open: 1_200_990, high: 1_201_935, low: 1_200_125, close: 1_200_150, volume: 163_275, oi: 13_667_775 });
  });

  it("rejects malformed candles instead of charting them", () => {
    expect(() => parseCandles({ status: "success", data: { candles: [["2017-12-15T09:15:00+0530", 1704.5]] } })).toThrow(KiteError);
    expect(() => parseCandles({ status: "success", data: { candles: [["2017-12-15T09:15:00+0530", -1, 1, 1, 1, 1]] } })).toThrow(KiteError);
    expect(() => parseCandles({ status: "success", data: {} })).toThrow(KiteError);
    expect(() => parseCandles("<html>")).toThrow(KiteError);
  });

  it("merges split requests in time order without repeating the shared edge", () => {
    const candle = (at: number, close: number) => ({ at, open: 1, high: 1, low: 1, close, volume: 0, oi: null });
    expect(mergeCandles([[candle(1, 1), candle(2, 2)], [candle(2, 3), candle(3, 4)]]).map((item) => [item.at, item.close])).toEqual([[1, 1], [2, 3], [3, 4]]);
  });
});

const FUTURE_QUOTE = {
  instrument_token: 13238786,
  timestamp: "2026-10-16 11:02:07",
  last_trade_time: "2026-10-16 11:02:06",
  last_price: 24610.5,
  last_quantity: 75,
  buy_quantity: 412_500,
  sell_quantity: 398_250,
  volume: 2_313_450,
  average_price: 24588.12,
  oi: 13_667_775,
  oi_day_high: 13_700_000,
  oi_day_low: 13_500_000,
  net_change: 0,
  lower_circuit_limit: 22149.45,
  upper_circuit_limit: 27071.55,
  ohlc: { open: 24510, high: 24640.2, low: 24498.1, close: 24507 },
  depth: {
    buy: [
      { price: 24610.4, quantity: 150, orders: 2 },
      { price: 24610.3, quantity: 75, orders: 1 },
      { price: 0, quantity: 0, orders: 0 },
    ],
    sell: [
      { price: 24610.6, quantity: 75, orders: 1 },
      { price: 24610.8, quantity: 300, orders: 3 },
    ],
  },
};

describe("quotes", () => {
  const received = ist("2026-10-16 11:02:08");
  const [future, index] = parseQuotes(
    {
      status: "success",
      data: {
        "NFO:NIFTY26OCTFUT": FUTURE_QUOTE,
        "NSE:NIFTY 50": { instrument_token: 256265, timestamp: "2026-10-16 11:02:07", last_price: 24567.35, ohlc: { open: 24480, high: 24590, low: 24470.15, close: 24466.9 } },
      },
    },
    received,
  );

  it("reads a contract quote in paise with depth, open interest and the previous close", () => {
    expect(future).toMatchObject({
      key: "NFO:NIFTY26OCTFUT",
      token: 13238786,
      at: ist("2026-10-16 11:02:07"),
      lastTradeAt: ist("2026-10-16 11:02:06"),
      lastPrice: 2_461_050,
      previousClose: 2_450_700,
      open: 2_451_000,
      high: 2_464_020,
      low: 2_449_810,
      volume: 2_313_450,
      oi: 13_667_775,
    });
    expect(future.bids).toEqual([{ price: 2_461_040, quantity: 150, orders: 2 }, { price: 2_461_030, quantity: 75, orders: 1 }]);
    expect(future.asks).toHaveLength(2);
  });

  it("reads an index quote without depth, volume or open interest", () => {
    expect(index).toMatchObject({ key: "NSE:NIFTY 50", token: 256265, lastPrice: 2_456_735, previousClose: 2_446_690, volume: 0, oi: null, lastTradeAt: null, bids: [], asks: [] });
  });

  it("feeds the trading core's book, so simulated fills walk Kite's depth", () => {
    const tick = toEngineQuote(future, received);
    expect(tick).toEqual({ token: 13238786, at: received, lastPrice: 2_461_050, bids: [{ price: 2_461_040, quantity: 150 }, { price: 2_461_030, quantity: 75 }], asks: [{ price: 2_461_060, quantity: 75 }, { price: 2_461_080, quantity: 300 }] });
    expect(walkBook("BUY", 150, bookFrom(tick), { limit: null, slippage: 0, tick: 5, fillAtLimit: false })).toEqual([
      { price: 2_461_060, quantity: 75 },
      { price: 2_461_080, quantity: 75 },
    ]);
  });

  it("finds instrument tokens in an LTP response", () => {
    const tokens = parseLtpTokens({ status: "success", data: { "NSE:NIFTY 50": { instrument_token: 256265, last_price: 24567.35 }, "BSE:SENSEX": { instrument_token: 265, last_price: 80000 } } });
    expect([...tokens]).toEqual([["NSE:NIFTY 50", 256265], ["BSE:SENSEX", 265]]);
  });
});

const CSV = [
  "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange",
  "13238786,51714,NIFTY26OCTFUT,NIFTY,0,2026-10-27,0,0.1,75,FUT,NFO-FUT,NFO",
  "13239042,51715,NIFTY26NOVFUT,NIFTY,0,2026-11-24,0,0.1,75,FUT,NFO-FUT,NFO",
  "10001,1,NIFTY2610224500CE,NIFTY,0,2026-10-20,24500,0.05,75,CE,NFO-OPT,NFO",
  "10002,2,NIFTY2610224500PE,NIFTY,0,2026-10-20,24500,0.05,75,PE,NFO-OPT,NFO",
  "10003,3,NIFTY2610224450CE,NIFTY,0,2026-10-20,24450,0.05,75,CE,NFO-OPT,NFO",
  "10004,4,NIFTY26OCT24500CE,NIFTY,0,2026-10-27,24500,0.05,75,CE,NFO-OPT,NFO",
  "10005,5,NIFTY2601324500CE,NIFTY,0,2026-10-13,24500,0.05,75,CE,NFO-OPT,NFO",
  '10006,6,BANKNIFTY26OCTFUT,"BANKNIFTY",0,2026-10-27,0,0.2,30,FUT,NFO-FUT,NFO',
  "10007,7,NIFTYNXT5026OCTFUT,NIFTYNXT50,0,2026-10-27,0,0.1,25,FUT,NFO-FUT,NFO",
  "10008,8,FINNIFTY26OCTFUT,FINNIFTY,0,2026-10-27,0,0.1,65,FUT,NFO-FUT,NFO",
  "10009,9,INFY26OCTFUT,INFY,0,2026-10-27,0,0.1,400,FUT,NFO-FUT,NFO",
  "",
].join("\n");

const BFO_CSV = [
  "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange",
  "20001,1,SENSEX26O2283000CE,SENSEX,0,2026-10-22,83000,0.05,20,CE,BFO-OPT,BFO",
  "20002,2,SENSEX5026OCTFUT,SENSEX50,0,2026-10-27,0,0.05,60,FUT,BFO-FUT,BFO",
  "20003,3,BANKEX26OCTFUT,BANKEX,0,2026-10-27,0,0.05,30,FUT,BFO-FUT,BFO",
].join("\r\n");

describe("instrument list", () => {
  it("keeps NIFTY, BANK NIFTY and SENSEX futures and options, in paise", () => {
    const contracts = parseContracts(CSV);
    expect(contracts.map((contract) => contract.tradingSymbol)).toEqual([
      "NIFTY26OCTFUT", "NIFTY26NOVFUT", "NIFTY2610224500CE", "NIFTY2610224500PE", "NIFTY2610224450CE", "NIFTY26OCT24500CE", "NIFTY2601324500CE", "BANKNIFTY26OCTFUT",
    ]);
    expect(contracts[0]).toEqual({ token: 13238786, exchange: "NFO", tradingSymbol: "NIFTY26OCTFUT", underlying: "NIFTY", kind: "FUT", expiry: "2026-10-27", strike: null, lotSize: 75, tickSize: 10 });
    expect(contracts[2]).toMatchObject({ kind: "CE", strike: 2_450_000, tickSize: 5 });
    expect(contracts[7]).toMatchObject({ underlying: "BANKNIFTY", lotSize: 30, tickSize: 20 });
    expect(parseContracts(BFO_CSV)).toEqual([
      { token: 20001, exchange: "BFO", tradingSymbol: "SENSEX26O2283000CE", underlying: "SENSEX", kind: "CE", expiry: "2026-10-22", strike: 8_300_000, lotSize: 20, tickSize: 5 },
    ]);
    expect(quoteKey(contracts[0])).toBe("NFO:NIFTY26OCTFUT");
  });

  it("refuses a list without the expected columns or with a broken row", () => {
    expect(() => parseContracts("token,symbol\n1,NIFTY")).toThrow(KiteError);
    expect(() => parseContracts(CSV.replace("2026-10-27,0,0.1,75,FUT", "2026-10-27,0,0.1,0,FUT"))).toThrow(KiteError);
  });

  it("groups live futures, option expiries and an expiry's strikes", () => {
    const { futures, expiries, chain } = contractsFor(parseContracts(CSV), "NIFTY", "2026-10-16");
    expect(futures.map((contract) => contract.expiry)).toEqual(["2026-10-27", "2026-11-24"]);
    expect(expiries).toEqual(["2026-10-20", "2026-10-27"]);
    expect(chain("2026-10-20").map((row) => [row.strike, row.call?.token ?? null, row.put?.token ?? null])).toEqual([
      [2_445_000, 10003, null],
      [2_450_000, 10001, 10002],
    ]);
    expect(contractsFor(parseContracts(CSV), "SENSEX", "2026-10-16").futures).toEqual([]);
  });
});

describe("quote keys", () => {
  it("accepts index and contract keys only", () => {
    for (const key of ["NSE:NIFTY 50", "NSE:NIFTY BANK", "BSE:SENSEX", "NFO:NIFTY26OCTFUT", "BFO:SENSEX26O2283000CE"]) expect(isQuoteKey(key)).toBe(true);
    for (const key of ["NSE:nifty", "MCX:GOLD", "NFO:", "NIFTY", "NFO:NIFTY?x=1", `NFO:${"A".repeat(41)}`]) expect(isQuoteKey(key)).toBe(false);
  });
});
