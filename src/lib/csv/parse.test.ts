import { describe, it, expect } from "vitest";
import { parseTradesCsv, detectPreset, normalizeDate, parseNumber, IBKR_PRESET } from "./parse";

describe("normalizeDate", () => {
  it("handles ISO, IBKR datetime, and US formats", () => {
    expect(normalizeDate("2026-06-12")).toBe("2026-06-12");
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

describe("parseTradesCsv (IBKR preset)", () => {
  const csv = [
    "Symbol,Date/Time,Quantity,T. Price,C. Price,Realized P/L,Comm/Fee,Asset Category",
    'ES,"2026-06-12, 10:00:00",1,5420.25,5428.00,387.50,2.10,Future',
    'NQ,"2026-06-12, 11:30:00",-1,18500,18460,"(200.00)",2.10,Future',
    "BADROW,,,,,,,",
  ].join("\n");

  it("detects the IBKR preset from headers", () => {
    const headers = csv.split("\n")[0].split(",");
    expect(detectPreset(headers)?.id).toBe("ibkr");
  });

  it("maps rows and flags invalid ones", () => {
    const result = parseTradesCsv(csv, IBKR_PRESET.mapping);
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]).toMatchObject({
      symbol: "ES",
      tradeDate: "2026-06-12",
      realizedPnl: 387.5,
      fees: 2.1,
      assetType: "Future",
    });
    expect(result.trades[1].realizedPnl).toBe(-200);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });
});
