import { describe, expect, it } from "vitest";
import { chargesForFill, scheduleFor, sumCharges, type ChargesSchedule } from "./charges";
import { CHARGES_SCHEDULES } from "./charges-schedules";

const schedule = scheduleFor("2026-11-02", CHARGES_SCHEDULES);
const first = { orderTurnoverBefore: 0, brokerageChargedBefore: 0 };

describe("F&O charges", () => {
  it("charges an NSE option buy: flat brokerage, stamp duty, no STT", () => {
    // 75 units at ₹120.50: premium ₹9,037.50.
    expect(chargesForFill({ kind: "CE", exchange: "NFO", side: "BUY", turnover: 9_03_750, ...first }, schedule)).toEqual({
      brokerage: 2_000, // ₹20
      stt: 0,
      transaction: 321, // 0.03553% = ₹3.2110 → ₹3.21
      sebi: 1, // ₹10 a crore = ₹0.0090 → ₹0.01
      stamp: 27, // 0.003% = ₹0.2711 → ₹0.27
      gst: 418, // 18% of ₹23.22 = ₹4.1796 → ₹4.18
      total: 2_767,
    });
  });

  it("charges an NSE option sell: STT on premium, no stamp duty", () => {
    // 75 units at ₹130: premium ₹9,750.
    expect(chargesForFill({ kind: "PE", exchange: "NFO", side: "SELL", turnover: 9_75_000, ...first }, schedule)).toEqual({
      brokerage: 2_000,
      stt: 1_463, // 0.15% = ₹14.625 → ₹14.63
      transaction: 346,
      sebi: 1,
      stamp: 0,
      gst: 422, // 18% of ₹23.47
      total: 4_232,
    });
  });

  it("charges NSE futures on traded value with brokerage capped at ₹20", () => {
    const buy = chargesForFill({ kind: "FUT", exchange: "NFO", side: "BUY", turnover: 18_75_000_00, ...first }, schedule);
    expect(buy).toEqual({ brokerage: 2_000, stt: 0, transaction: 3_431, sebi: 188, stamp: 3_750, gst: 1_011, total: 10_380 });
    const sell = chargesForFill({ kind: "FUT", exchange: "NFO", side: "SELL", turnover: 18_75_000_00, ...first }, schedule);
    expect(sell.stt).toBe(93_750); // 0.05% of ₹18,75,000
    expect(sell.stamp).toBe(0);
  });

  it("uses BSE rates for SENSEX contracts", () => {
    const option = chargesForFill({ kind: "CE", exchange: "BFO", side: "BUY", turnover: 10_00_000, ...first }, schedule);
    expect(option.transaction).toBe(325); // 0.0325% of ₹10,000
    const future = chargesForFill({ kind: "FUT", exchange: "BFO", side: "BUY", turnover: 10_00_000_00, ...first }, schedule);
    expect(future.transaction).toBe(0);
  });

  it("charges brokerage once per executed order across partial fills", () => {
    const fill = { kind: "CE" as const, exchange: "NFO" as const, side: "BUY" as const, turnover: 2_41_000 };
    expect(chargesForFill({ ...fill, ...first }, schedule).brokerage).toBe(2_000);
    expect(chargesForFill({ ...fill, orderTurnoverBefore: 2_41_000, brokerageChargedBefore: 2_000 }, schedule).brokerage).toBe(0);
  });

  it("tops up 'lower of' brokerage until it reaches the cap", () => {
    const fill = { kind: "FUT" as const, exchange: "NFO" as const, side: "BUY" as const };
    expect(chargesForFill({ ...fill, turnover: 10_00_000, ...first }, schedule).brokerage).toBe(300); // 0.03% of ₹10,000
    expect(chargesForFill({ ...fill, turnover: 1_00_00_000, orderTurnoverBefore: 10_00_000, brokerageChargedBefore: 300 }, schedule).brokerage).toBe(1_700);
  });

  it("adds up breakdowns field by field", () => {
    const a = chargesForFill({ kind: "CE", exchange: "NFO", side: "BUY", turnover: 9_03_750, ...first }, schedule);
    const b = chargesForFill({ kind: "PE", exchange: "NFO", side: "SELL", turnover: 9_75_000, ...first }, schedule);
    expect(sumCharges([a, b]).total).toBe(a.total + b.total);
    expect(sumCharges([]).total).toBe(0);
  });

  it("picks the latest schedule in force and refuses dates before any schedule", () => {
    const later: ChargesSchedule = { ...schedule, id: "later", effectiveFrom: "2027-04-01" };
    expect(scheduleFor("2027-03-31", [schedule, later]).id).toBe(schedule.id);
    expect(scheduleFor("2027-04-01", [later, schedule]).id).toBe("later");
    expect(() => scheduleFor("2026-03-31", CHARGES_SCHEDULES)).toThrow(/No charges schedule/);
  });

  it("keeps the shipped schedule marked unverified until a contract note matches", () => {
    expect(CHARGES_SCHEDULES.every((row) => row.verified === false)).toBe(true);
    expect(new Set(CHARGES_SCHEDULES.map((row) => row.id)).size).toBe(CHARGES_SCHEDULES.length);
  });
});
