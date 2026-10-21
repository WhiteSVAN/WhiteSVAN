import { describe, it, expect } from "vitest";
import {
  parseFidelityActivity,
  parseWebullOrders,
  parseZerodhaTradebook,
  detectBrokerFormat,
} from "./brokers";
import { isProgrammeContract } from "@/lib/track-record";

// Fidelity Accounts History: BOM + blank line, a stock round-trip (3 buys → 1
// sell), an option round-trip, a 401k "Exchanges" row, and a disclaimer footer.
const FIDELITY_CSV = [
  "﻿",
  "",
  "Run Date,Account,Account Number,Action,Symbol,Description,Type,Price ($),Quantity,Commission ($),Fees ($),Accrued Interest ($),Amount ($),Settlement Date",
  '06/04/2026,"Individual - TOD","Z07","YOU BOUGHT AMAZON.COM INC (AMZN) (Margin)",AMZN,"AMAZON.COM INC",Margin,254.46,400,,,,-101784,06/05/2026',
  '06/04/2026,"Individual - TOD","Z07","YOU BOUGHT AMAZON.COM INC (AMZN) (Margin)",AMZN,"AMAZON.COM INC",Margin,253.9,200,,,,-50779,06/05/2026',
  '06/04/2026,"Individual - TOD","Z07","YOU BOUGHT AMAZON.COM INC (AMZN) (Margin)",AMZN,"AMAZON.COM INC",Margin,253.74,100,,,,-25374,06/05/2026',
  '06/04/2026,"Individual - TOD","Z07","YOU SOLD AMAZON.COM INC (AMZN) (Margin)",AMZN,"AMAZON.COM INC",Margin,253.85,-700,,3.67,,177691.33,06/05/2026',
  '06/08/2026,"Individual - TOD","Z07","YOU BOUGHT OPENING TRANSACTION PUT (TSLA) TESLA INC COM JUN 08 26 $400 (100 SHS) (Margin)", -TSLA260608P400,"PUT (TSLA) TESLA INC COM JUN 08 26 $400 (100 SHS)",Margin,2.65,10,6.5,0.23,,-2656.73,06/09/2026',
  '06/08/2026,"Individual - TOD","Z07","YOU SOLD CLOSING TRANSACTION PUT (TSLA) TESLA INC COM JUN 08 26 $400 (100 SHS) (Margin)", -TSLA260608P400,"PUT (TSLA) TESLA INC COM JUN 08 26 $400 (100 SHS)",Margin,3.19,-10,6.5,0.3,,3183.2,06/09/2026',
  '04/27/2026,"BOX, INC.","58356","Exchanges",,"TRP RET BLEND 2060 G",,-4622.2,,,,,-112504.34,',
  '"The data and information in this spreadsheet is provided to you solely for your use and is not for distribution."',
].join("\n");

describe("parseFidelityActivity", () => {
  const result = parseFidelityActivity(FIDELITY_CSV);

  it("FIFO-matches the stock round-trip into one closed trade", () => {
    const amzn = result.trades.find((t) => t.symbol === "AMZN");
    expect(amzn).toBeDefined();
    expect(amzn).toMatchObject({ tradeDate: "2026-06-04", side: "SELL", quantity: 700, assetType: "stock" });
    // Gross: 400×(253.85−254.46) + 200×(253.85−253.895) + 100×(253.85−253.74) = −242
    expect(amzn!.realizedPnl).toBeCloseTo(-242, 1);
    expect(amzn!.fees).toBeCloseTo(3.67, 2); // net = gross − fees = −245.67
  });

  it("derives option P&L from net Amount (100× multiplier already in Amount)", () => {
    const tsla = result.trades.find((t) => t.symbol === "TSLA260608P400");
    expect(tsla).toMatchObject({ assetType: "option", quantity: 10, side: "SELL" });
    expect(tsla!.realizedPnl).toBeCloseTo(540, 2); // 10 × (319 − 265)
    expect(tsla!.fees).toBeCloseTo(13.53, 2); // 6.73 + 6.8 → net 526.47
  });

  it("ignores fund exchanges and the disclaimer footer, leaving nothing open", () => {
    expect(result.trades).toHaveLength(2);
    expect(result.fills).toBe(6); // 4 AMZN + 2 TSLA; BOX & disclaimer skipped silently
    expect(result.openPositions).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// Webull Orders export — standard US columns. No fees, no cash Amount column, so
// value = Avg Price × multiplier. Includes a cancelled order that must be dropped.
const WEBULL_CSV = [
  "Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,Placed Time,Filled Time",
  "Apple Inc,AAPL,Buy,Filled,100,100,150.00,150.00,DAY,06/10/2026 09:30:00 EDT,06/10/2026 09:30:05 EDT",
  "Apple Inc,AAPL,Sell,Filled,100,100,155.00,155.00,DAY,06/11/2026 10:00:00 EDT,06/11/2026 10:00:02 EDT",
  "TSLA260620C400 Call,TSLA260620C400,Buy,Filled,2,2,3.00,3.00,DAY,06/09/2026,06/09/2026 09:31:00 EDT",
  "TSLA260620C400 Call,TSLA260620C400,Sell,Filled,2,2,5.00,5.00,DAY,06/09/2026,06/09/2026 14:00:00 EDT",
  "Apple Inc,AAPL,Buy,Cancelled,0,100,140.00,,DAY,06/08/2026,06/08/2026",
].join("\n");

describe("parseWebullOrders", () => {
  const result = parseWebullOrders(WEBULL_CSV);

  it("matches the stock round-trip on filled time, fees $0", () => {
    const aapl = result.trades.find((t) => t.symbol === "AAPL");
    expect(aapl).toMatchObject({
      tradeDate: "2026-06-11",
      side: "SELL",
      quantity: 100,
      assetType: "stock",
      realizedPnl: 500, // 100 × (155 − 150)
      fees: 0,
    });
  });

  it("applies the 100× multiplier to options", () => {
    const tsla = result.trades.find((t) => t.symbol === "TSLA260620C400");
    expect(tsla).toMatchObject({ assetType: "option", quantity: 2 });
    expect(tsla!.realizedPnl).toBe(400); // 2 × (500 − 300)
  });

  it("drops cancelled orders and matches everything else", () => {
    expect(result.fills).toBe(4); // cancelled excluded
    expect(result.matched).toBe(2);
    expect(result.openPositions).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// Zerodha Console tradebook, in the real export's columns: a NIFTY put sold in one order
// (3 fills) and bought back in another (2 fills), an equity round trip, a SENSEX call still
// open and a NIFTY call that expired without a closing trade.
const ZERODHA_HEADER = "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time,expiry_date";
const ZERODHA_CSV = [
  ZERODHA_HEADER,
  "NIFTY2660524750PE,,2026-06-02,NSE,FO,,sell,false,150.000000,326.800000,238243,1500000005277076,2026-06-02T09:21:55,2026-06-05",
  "NIFTY2660524750PE,,2026-06-02,NSE,FO,,sell,false,75.000000,326.900000,238241,1500000005277076,2026-06-02T09:21:55,2026-06-05",
  "NIFTY2660524750PE,,2026-06-02,NSE,FO,,sell,false,75.000000,326.850000,238242,1500000005277076,2026-06-02T09:21:55,2026-06-05",
  "NIFTY2660524750PE,,2026-06-02,NSE,FO,,buy,false,150.000000,341.000000,279744,1500000005629196,2026-06-02T09:23:50,2026-06-05",
  "NIFTY2660524750PE,,2026-06-02,NSE,FO,,buy,false,150.000000,341.050000,279745,1500000005629196,2026-06-02T09:23:50,2026-06-05",
  "ESCORTS,INE042A01014,2026-06-02,NSE,EQ,EQ,buy,False,1.0,3360.0,206325031,1100000058853326,2026-06-02T14:04:51",
  "ESCORTS,INE042A01014,2026-06-02,NSE,EQ,EQ,sell,False,1.0,3370.0,206325032,1100000058853327,2026-06-02T15:04:51",
  "SENSEX2660982000CE,,2026-06-03,BSE,FO,,buy,false,20.000000,150.000000,1,2000000000000001,2026-06-03T10:00:00,2026-06-09",
  "NIFTY2660424000CE,,2026-06-01,NSE,FO,,buy,false,75.000000,10.000000,5,1500000000000009,2026-06-01T10:00:00,2026-06-04",
].join("\n");

describe("parseZerodhaTradebook", () => {
  const result = parseZerodhaTradebook(ZERODHA_CSV, { today: "2026-06-06" });
  const nifty = result.trades.filter((t) => t.symbol === "NIFTY2660524750PE");

  it("FIFO-matches the short put by execution time", () => {
    expect(nifty).toHaveLength(2); // one trade per closing fill
    expect(nifty.every((t) => t.side === "BUY" && t.assetType === "option")).toBe(true);
    // Sold for ₹98,051.25 and bought back for ₹1,02,307.50.
    expect(nifty.reduce((sum, t) => sum + t.realizedPnl, 0)).toBeCloseTo(-4256.25, 2);
  });

  it("estimates F&O charges per order from the dated Zerodha rate card", () => {
    // Sell order ₹211.89 (₹20 brokerage once, STT, NSE charges, SEBI fee, GST on all three
    // fills) + buy order ₹69.67 (₹20 brokerage once, stamp duty, NSE charges, SEBI fee, GST).
    expect(nifty.reduce((sum, t) => sum + t.fees, 0)).toBeCloseTo(281.56, 2);
  });

  it("matches equity at zero charges and says so", () => {
    expect(result.trades.find((t) => t.symbol === "ESCORTS")).toMatchObject({ assetType: "stock", realizedPnl: 10, fees: 0 });
    expect(result.notes).toContain("2 equity fills count before charges: equity charges aren't estimated.");
  });

  it("reports an expired position and an open one without pricing either", () => {
    expect(result.openPositions).toBe(2);
    expect(result.notes).toContain("1 position reached expiry without a closing trade. Zerodha settles those outside the tradebook, so their result isn't counted.");
    expect(result.notes).toContain("1 position still open: it counts once closed.");
    expect(result.errors).toHaveLength(0);
  });

  it("keeps only the contracts asked for", () => {
    const only = parseZerodhaTradebook(ZERODHA_CSV, { today: "2026-06-06", include: isProgrammeContract });
    expect(only.trades.map((t) => t.symbol)).not.toContain("ESCORTS");
    expect(only.notes).toContain("2 fills outside the contracts counted here were left out.");
  });

  it("leaves trades before the first rate card uncharged, with a note", () => {
    const early = parseZerodhaTradebook(
      [ZERODHA_HEADER,
        "NIFTY25JUNFUT,,2025-06-02,NSE,FO,,buy,false,75,24000,1,1,2025-06-02T09:30:00,2025-06-26",
        "NIFTY25JUNFUT,,2025-06-02,NSE,FO,,sell,false,75,24010,2,2,2025-06-02T10:30:00,2025-06-26"].join("\n"),
      { today: "2026-06-06" },
    );
    expect(early.trades).toHaveLength(1);
    expect(early.trades[0]).toMatchObject({ assetType: "future", realizedPnl: 750, fees: 0 });
    expect(early.notes).toContain("2 F&O fills before 1 Apr 2026 count before charges: no rate card is on file for those dates.");
  });
});

describe("detectBrokerFormat", () => {
  it("recognizes Fidelity activity, Webull orders and Zerodha tradebooks, and abstains otherwise", () => {
    expect(detectBrokerFormat(FIDELITY_CSV)).toBe("fidelity");
    expect(detectBrokerFormat(WEBULL_CSV)).toBe("webull");
    expect(detectBrokerFormat(ZERODHA_CSV)).toBe("zerodha");
    // An IBKR Flex realized-P&L CSV is auto-detect's job, not a broker adapter's.
    const ibkr = "ClientAccountID,Symbol,Quantity,TradePrice,FifoPnlRealized,Buy/Sell\nU1,AMZN,-36,209.4,2051.9,SELL";
    expect(detectBrokerFormat(ibkr)).toBeNull();
  });
});
