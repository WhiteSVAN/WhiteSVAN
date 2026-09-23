import { describe, expect, it } from "vitest";
import {
  currencySymbol,
  defaultCurrencyForRegion,
  formatCompactSigned,
  formatMoney,
  isCurrency,
  toCurrency,
} from "./format";

describe("formatMoney", () => {
  it("defaults to whole US dollars (backward compatible)", () => {
    expect(formatMoney(1250)).toBe("$1,250");
    expect(formatMoney(1250.5, { cents: true })).toBe("$1,250.50");
    expect(formatMoney(-400)).toBe("-$400");
  });

  it("uses Indian digit grouping for INR", () => {
    expect(formatMoney(1234567, { currency: "INR" })).toBe("₹12,34,567");
    expect(formatMoney(1234567.5, { currency: "INR", cents: true })).toBe("₹12,34,567.50");
  });

  it("formats the other supported currencies", () => {
    expect(formatMoney(1000, { currency: "EUR" })).toBe("€1,000");
    expect(formatMoney(1000, { currency: "GBP" })).toBe("£1,000");
    expect(formatMoney(1000, { currency: "SGD" })).toContain("1,000");
    expect(formatMoney(1000, { currency: "AED" })).toContain("1,000");
  });

  it("falls back to USD for unknown or missing codes", () => {
    expect(formatMoney(10, { currency: "XYZ" })).toBe("$10");
    expect(formatMoney(10, { currency: null })).toBe("$10");
  });
});

describe("currency helpers", () => {
  it("validates and normalizes codes", () => {
    expect(isCurrency("INR")).toBe(true);
    expect(isCurrency("inr")).toBe(false);
    expect(toCurrency(" inr ")).toBe("INR");
    expect(toCurrency("JPY")).toBe("USD");
    expect(toCurrency(undefined, "INR")).toBe("INR");
  });

  it("picks INR for India and USD elsewhere", () => {
    expect(defaultCurrencyForRegion("IN")).toBe("INR");
    expect(defaultCurrencyForRegion("US")).toBe("USD");
    expect(defaultCurrencyForRegion(null)).toBe("USD");
  });

  it("returns the currency sign", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("INR")).toBe("₹");
    expect(currencySymbol(undefined)).toBe("$");
  });
});

describe("formatCompactSigned", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatCompactSigned(850)).toBe("+850");
    expect(formatCompactSigned(-1250)).toBe("-1.3k");
    expect(formatCompactSigned(2_500_000)).toBe("+2.5M");
  });

  it("uses lakh and crore for INR", () => {
    expect(formatCompactSigned(250_000, "INR")).toBe("+2.5L");
    expect(formatCompactSigned(-32_000_000, "INR")).toBe("-3.2Cr");
    expect(formatCompactSigned(4_500, "INR")).toBe("+4.5k");
  });
});
