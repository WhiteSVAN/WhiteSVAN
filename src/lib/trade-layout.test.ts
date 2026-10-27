import { describe, expect, it } from "vitest";
import { ARRANGEMENTS, clampOrdersHeight, DEFAULT_LAYOUT, ORDERS_HEIGHT, parseLayout } from "./trade-layout";

describe("the trading platform's layout", () => {
  it("offers three arrangements, and starts with the window choosing", () => {
    expect(ARRANGEMENTS.map((item) => item.id)).toEqual(["three", "two", "stacked"]);
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(DEFAULT_LAYOUT).toMatchObject({ arrangement: null, chart: "left", book: true, orders: true, meters: true });
  });

  it("keeps a saved choice", () => {
    const saved = { arrangement: "stacked", chart: "right", book: false, orders: true, meters: false, ordersHeight: 300 };
    expect(parseLayout(JSON.stringify(saved))).toEqual(saved);
  });

  it("takes the default for anything missing or malformed", () => {
    for (const saved of ["not json", "[]", "42", "null", JSON.stringify({ arrangement: "four", chart: "up", book: "yes", ordersHeight: "tall" })]) {
      expect(parseLayout(saved)).toEqual(DEFAULT_LAYOUT);
    }
    expect(parseLayout(JSON.stringify({ orders: false }))).toEqual({ ...DEFAULT_LAYOUT, orders: false });
  });

  it("keeps the orders window between its smallest and largest height", () => {
    expect([clampOrdersHeight(10), clampOrdersHeight(255.6), clampOrdersHeight(5_000)]).toEqual([ORDERS_HEIGHT.min, 256, ORDERS_HEIGHT.max]);
    expect(parseLayout(JSON.stringify({ ordersHeight: 99_999 })).ordersHeight).toBe(ORDERS_HEIGHT.max);
    expect(parseLayout(JSON.stringify({ ordersHeight: Number.NaN })).ordersHeight).toBe(DEFAULT_LAYOUT.ordersHeight);
  });
});
