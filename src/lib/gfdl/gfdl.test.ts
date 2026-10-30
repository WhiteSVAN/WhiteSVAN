import { describe, expect, it } from "vitest";
import { gfdlConfig, GFDL_TRIAL_KEY, GFDL_TRIAL_URL } from "./config";
import { gfdlDate, gfdlQuote, historyRequest, indexUnderlying, instrumentsRequest, nearestExpiries, parseGfdlCandles, parseGfdlContracts } from "./gfdl";

// Shapes from the trial key's replies on 30 Oct 2026.
const instruments = {
  Request: { Exchange: "BFO", InstrumentType: "IO", Product: "SENSEX", MessageType: "GetInstruments" },
  Result: [
    { TokenNumber: "1134329", Series: "SENSEX26N0575000CE", Identifier: "IO_SENSEX_05NOV2026_CE_75000", Name: "IO", Expiry: "05Nov2026", StrikePrice: 75000.0, Product: "SENSEX", OptionType: "CE", QuotationLot: 20.0, Description: "SENSEX26N0575000CE" },
    { TokenNumber: "1134201", Series: "", Identifier: "IO_SENSEX_05NOV2026_PE_74900", Expiry: "05NOV2026", StrikePrice: 74900.0, OptionType: "PE", QuotationLot: 20.0, Description: "SENSEX26N0574900PE" },
    { TokenNumber: "", Identifier: "IO_SENSEX_25DEC2026_CE_66000", Expiry: "25Dec2026", StrikePrice: 66000.0, OptionType: "CE", QuotationLot: 20.0, Description: "" },
  ],
  MessageType: "InstrumentsResult",
};

const realtime = {
  Exchange: "BFO", InstrumentIdentifier: "IO_SENSEX_05NOV2026_CE_75000", LastTradeTime: 1793350934, ServerTime: 1793350934, AverageTradedPrice: 332.29,
  BuyPrice: 343.25, BuyQty: 220, Close: 287.15, High: 473.0, Low: 223.55, LastTradePrice: 344.0, LastTradeQty: 20, Open: 290.0, OpenInterest: 539020,
  QuotationLot: 20.0, SellPrice: 344.1, SellQty: 0, TotalQtyTraded: 10841360, MessageType: "RealtimeResult",
};

describe("GFDL parsing", () => {
  it("runs on the trial key and endpoint unless told otherwise", () => {
    expect(gfdlConfig({})).toEqual({ apiKey: GFDL_TRIAL_KEY, url: GFDL_TRIAL_URL });
    expect(gfdlConfig({ GFDL_API_KEY: " key " })).toEqual({ apiKey: "key", url: GFDL_TRIAL_URL });
    expect(gfdlConfig({ GFDL_API_KEY: "key", GFDL_WS_URL: "wss://example.test/" })?.url).toBe("wss://example.test/");
  });

  it("reads GFDL expiries in either case", () => {
    expect(gfdlDate("05Nov2026")).toBe("2026-11-05");
    expect(gfdlDate("25DEC2026")).toBe("2026-12-25");
    expect(() => gfdlDate("2026-11-05")).toThrow();
  });

  it("asks for an exchange's index options by its own type name", () => {
    expect(instrumentsRequest("BFO", "SENSEX")).toMatchObject({ Exchange: "BFO", InstrumentType: "IO", Product: "SENSEX" });
    expect(instrumentsRequest("NFO", "BANKNIFTY")).toMatchObject({ Exchange: "NFO", InstrumentType: "OPTIDX", Product: "BANKNIFTY" });
  });

  it("picks the nearest expiries from today, in GFDL's spelling", () => {
    const body = { Request: { Exchange: "BFO", InstrumentType: "IO", Product: "SENSEX", MessageType: "GetExpiryDates" }, Result: [{ Value: "12NOV2026" }, { Value: "29OCT2026" }, { Value: "05NOV2026" }, { Value: "31DEC2027" }, { Value: "19NOV2026" }], MessageType: "ExpiryDatesResult" };
    expect(nearestExpiries(body, "2026-10-30", 2)).toEqual(["05NOV2026", "12NOV2026"]);
    expect(instrumentsRequest("BFO", "SENSEX", "05NOV2026")).toMatchObject({ Expiry: "05NOV2026", DetailedInfo: "true" });
  });

  it("turns the instrument list into contracts, leaving out rows it can't trade", () => {
    const contracts = parseGfdlContracts(instruments, "BFO", "SENSEX");
    expect(contracts).toEqual([
      { token: 1134329, exchange: "BFO", tradingSymbol: "SENSEX26N0575000CE", underlying: "SENSEX", kind: "CE", expiry: "2026-11-05", strike: 7_500_000, lotSize: 20, tickSize: 5, identifier: "IO_SENSEX_05NOV2026_CE_75000" },
      { token: 1134201, exchange: "BFO", tradingSymbol: "SENSEX26N0574900PE", underlying: "SENSEX", kind: "PE", expiry: "2026-11-05", strike: 7_490_000, lotSize: 20, tickSize: 5, identifier: "IO_SENSEX_05NOV2026_PE_74900" },
    ]);
    expect(() => parseGfdlContracts({ MessageType: "InstrumentsResult" }, "BFO", "SENSEX")).toThrow();
  });

  it("turns a push into a quote in paise, with the best bid and offer that have size", () => {
    const quote = gfdlQuote(realtime, "BFO:SENSEX26N0575000CE", 1134329, false, 1_793_350_934_500);
    expect(quote).toEqual({
      key: "BFO:SENSEX26N0575000CE", token: 1134329, at: 1_793_350_934_500, lastTradeAt: 1_793_350_934_000, lastPrice: 34_400, previousClose: 28_715,
      open: 29_000, high: 47_300, low: 22_355, volume: 10_841_360, oi: 539_020, bids: [{ price: 34_325, quantity: 220, orders: 0 }], asks: [],
    });
  });

  it("reads the future standing in for an index like an index quote", () => {
    const quote = gfdlQuote({ ...realtime, InstrumentIdentifier: "SENSEX-I", LastTradePrice: 74801.0 }, "BSE:SENSEX", 9_000_000_003, true, 0);
    expect(quote).toMatchObject({ key: "BSE:SENSEX", lastPrice: 7_480_100, volume: 0, oi: null, bids: [], asks: [] });
    expect(indexUnderlying("BSE:SENSEX")).toBe("SENSEX");
    expect(indexUnderlying("BFO:SENSEX26N0575000CE")).toBeNull();
  });

  it("asks for history in epoch seconds, capping intraday lookback at GFDL's limit", () => {
    const now = Date.UTC(2026, 9, 30, 9, 0);
    expect(historyRequest("BFO", "SENSEX-I", "5minute", now)).toMatchObject({ Periodicity: "MINUTE", Period: 5, To: now / 1000, From: now / 1000 - 21 * 86_400 });
    expect(historyRequest("BFO", "SENSEX-I", "60minute", now)).toMatchObject({ Periodicity: "HOUR", Period: 1, From: now / 1000 - 60 * 86_400 });
    expect(historyRequest("BFO", "SENSEX-I", "day", now)).toMatchObject({ Periodicity: "DAY", Period: 1 });
  });

  it("puts candles in time order, day candles at IST midnight", () => {
    const body = {
      Result: [
        { LastTradeTime: 1793350800, TradedQty: 60, OpenInterest: 68740, Open: 74789.5, High: 74863.5, Low: 74789.5, Close: 74863.5 },
        { LastTradeTime: 1793350740, TradedQty: 20, OpenInterest: 68700, Open: 74780.0, High: 74790.0, Low: 74775.0, Close: 74789.5 },
      ],
      MessageType: "HistoryOHLCResult",
    };
    const minutes = parseGfdlCandles(body, "minute", true);
    expect(minutes.map((candle) => candle.at)).toEqual([1_793_350_740_000, 1_793_350_800_000]);
    expect(minutes[1]).toEqual({ at: 1_793_350_800_000, open: 7_478_950, high: 7_486_350, low: 7_478_950, close: 7_486_350, volume: 60, oi: 68_740 });
    const days = parseGfdlCandles({ Result: [{ ...body.Result[0], LastTradeTime: 1793350800 }] }, "day", false);
    // 30 Oct 2026 00:00 IST.
    expect(days[0]).toMatchObject({ at: Date.UTC(2026, 9, 29, 18, 30), oi: null });
  });
});
