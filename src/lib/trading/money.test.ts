import { describe, expect, it } from "vitest";
import { applyRate, divCeil, divFloor, divRound, formatPaise, parseRupees, percentOfFloor, toPaise, toRupees } from "./money";

describe("paise maths", () => {
  it("converts rupees with up to two decimals and rejects sub-paisa precision", () => {
    expect(toPaise(1_00_000)).toBe(1_00_00_000);
    expect(toPaise(123.45)).toBe(12_345);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(() => toPaise(1.005)).toThrow(/precision/);
    expect(() => toPaise(Number.NaN)).toThrow();
    expect(toRupees(12_345)).toBe(123.45);
  });

  it("rounds half away from zero exactly", () => {
    expect(divRound(5, 10)).toBe(1);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(-5, 10)).toBe(-1);
    expect(divRound(-15, 10)).toBe(-2);
    expect(divRound(9_007_199_254_740_990, 100_000_000)).toBe(90_071_993);
    expect(divFloor(19, 10)).toBe(1);
    expect(divCeil(11, 10)).toBe(2);
    expect(divCeil(10, 10)).toBe(1);
  });

  it("applies integer rates without floating-point drift", () => {
    expect(applyRate(18_75_000_00, 50_000)).toBe(93_750); // 0.05% of ₹18,75,000 = ₹937.50
    expect(applyRate(9_03_750, 100)).toBe(1); // ₹10 a crore on ₹9,037.50 rounds to a paisa
    expect(applyRate(1, 49_999_999)).toBe(0);
    expect(applyRate(1, 50_000_000)).toBe(1);
    expect(() => applyRate(9_000_000_000_000, 18_000_000)).toThrow(/too large/);
    expect(() => applyRate(100, -1)).toThrow();
  });

  it("takes whole-number percentages rounding down", () => {
    expect(percentOfFloor(1_00_00_000, 6)).toBe(6_00_000);
    expect(percentOfFloor(999, 80)).toBe(799);
    expect(percentOfFloor(-500, 80)).toBe(0);
  });

  it("parses typed rupee amounts exactly", () => {
    expect(parseRupees("1,02,500")).toBe(1_02_50_000);
    expect(parseRupees("-600.5")).toBe(-60_050);
    expect(parseRupees("-0")).toBe(0);
    expect(parseRupees("123456789")).toBeNull();
    expect(parseRupees("123456789", 9)).toBe(12_345_678_900);
    for (const bad of ["", "-", "1e3", "12.345", "₹500", "abc"]) expect(parseRupees(bad)).toBeNull();
  });

  it("formats Indian rupees", () => {
    expect(formatPaise(1_00_00_000)).toBe("₹1,00,000.00");
    expect(formatPaise(-25_250)).toBe("-₹252.50");
    expect(formatPaise(6_00_000, 0)).toBe("₹6,000");
  });
});
