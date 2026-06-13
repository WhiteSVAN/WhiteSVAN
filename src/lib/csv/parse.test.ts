import { describe, it, expect } from "vitest";
import { parseTradesCsv, autoMap, normalizeDate, parseNumber } from "./parse";

describe("normalizeDate", () => {
  it("handles ISO, IBKR compact, IBKR datetime, and US formats", () => {
    expect(normalizeDate("2026-06-12")).toBe("2026-06-12");
    expect(normalizeDate("20260612")).toBe("2026-06-12"); // IBKR Flex compact
    expect(normalizeDate("20260612;131838")).toBe("2026-06-12"); // IBKR Flex DateTime
    expect(normalizeDate("2026-06-12, 10:00:00")).toBe("2026-06-12");
    expect(normalizeDate("06/12/2026")).toBe("2026-06-12");
    expect(normalizeDate("2026/6/2")).toBe("2026-06-02");
    expect(normalizeDate("not a date")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("tolerates commas, currency, and parenthesized negatives", () => {
    expect(parseNumber("1,250.50")).toBe(1250.5);
    expect(parseNumber("$1,000")).toBe(1000);
    expect(parseNumber("(45.00)")).toBe(-45);
    expect(parseNumber("-12.4")).toBe(-12.4);
    expect(parseNumber("")).toBeNull();
  });
});

describe("autoMap", () => {
  it("maps IBKR Flex Query 'select all' headers", () => {
    const headers = [
      "ClientAccountID", "AssetClass", "Symbol", "Quantity", "TradePrice",
      "ClosePrice", "IBCommission", "DateTime", "TradeDate", "FifoPnlRealized", "Buy/Sell",
    ];
    expect(autoMap(headers)).toMatchObject({
      tradeDate: "TradeDate",
      symbol: "Symbol",
      assetType: "AssetClass",
      side: "Buy/Sell",
      quantity: "Quantity",
      entryPrice: "TradePrice",
      exitPrice: "ClosePrice",
      realizedPnl: "FifoPnlRealized",
      fees: "IBCommission",
      accountName: "ClientAccountID",
    });
  });

  it("maps the manual template headers", () => {
    const headers = ["trade_date", "symbol", "side", "quantity", "realized_pnl", "fees", "account_name"];
    expect(autoMap(headers)).toMatchObject({
      tradeDate: "trade_date",
      symbol: "symbol",
      realizedPnl: "realized_pnl",
      fees: "fees",
    });
  });

  it("prefers TradeDate over DateTime for the date field", () => {
    expect(autoMap(["DateTime", "TradeDate"]).tradeDate).toBe("TradeDate");
  });
});

describe("parseTradesCsv (IBKR Flex, auto-mapped)", () => {
  const csv = [
    "ClientAccountID,AssetClass,Symbol,Quantity,TradePrice,IBCommission,TradeDate,FifoPnlRealized,Buy/Sell",
    "U1,STK,AMZN,-36,209.405,-1.00702,20260326,2051.984505,SELL",
    "U1,STK,AMZN,1,209.3,-1,20260326,0,BUY",
    "U1,STK,,,,,20260326,,",
  ].join("\n");

  it("auto-maps, parses compact dates, and de-signs commissions", () => {
    const result = parseTradesCsv(csv, autoMap(csv.split("\n")[0].split(",")));
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]).toMatchObject({
      symbol: "AMZN",
      tradeDate: "2026-03-26",
      realizedPnl: 2051.984505,
      fees: 1.00702, // abs of -1.00702
      side: "SELL",
      assetType: "STK",
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });
});

describe("autoMap (broker gain/loss + transaction exports)", () => {
  it("maps Fidelity Realized Gain/Loss columns", () => {
    const headers = [
      "Symbol", "Security Description", "Quantity", "Date Acquired", "Date Sold",
      "Proceeds", "Cost Basis", "Total Gain/Loss",
    ];
    const m = autoMap(headers);
    expect(m.symbol).toBe("Symbol");
    expect(m.tradeDate).toBe("Date Sold"); // not "Date Acquired"
    expect(m.realizedPnl).toBe("Total Gain/Loss");
  });

  it("maps E*TRADE Gains & Losses columns", () => {
    const headers = ["Symbol", "Quantity", "Date Acquired", "Date Sold", "Proceeds", "Total Cost", "Gain/Loss"];
    const m = autoMap(headers);
    expect(m.tradeDate).toBe("Date Sold");
    expect(m.realizedPnl).toBe("Gain/Loss");
  });

  it("recognizes Robinhood transaction columns but finds no realized P&L", () => {
    const headers = [
      "Activity Date", "Process Date", "Settle Date", "Account Type", "Instrument",
      "Description", "Trans Code", "Quantity", "Price", "Amount",
    ];
    const m = autoMap(headers);
    expect(m.symbol).toBe("Instrument");
    expect(m.tradeDate).toBe("Activity Date");
    expect(m.side).toBe("Trans Code");
    expect(m.realizedPnl).toBeUndefined(); // transaction export → needs a FIFO matcher
  });
});
