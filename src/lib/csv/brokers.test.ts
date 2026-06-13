import { describe, it, expect } from "vitest";
import {
  parseFidelityActivity,
  parseWebullOrders,
  detectBrokerFormat,
} from "./brokers";

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

describe("detectBrokerFormat", () => {
  it("recognizes Fidelity activity and Webull orders, and abstains otherwise", () => {
    expect(detectBrokerFormat(FIDELITY_CSV)).toBe("fidelity");
    expect(detectBrokerFormat(WEBULL_CSV)).toBe("webull");
    // An IBKR Flex realized-P&L CSV is auto-detect's job, not a broker adapter's.
    const ibkr = "ClientAccountID,Symbol,Quantity,TradePrice,FifoPnlRealized,Buy/Sell\nU1,AMZN,-36,209.4,2051.9,SELL";
    expect(detectBrokerFormat(ibkr)).toBeNull();
  });
});
