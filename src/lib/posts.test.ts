import { describe, expect, it } from "vitest";
import {
  FIELD_PREFIX,
  flagReason,
  isCalendarDate,
  matchAnySymbol,
  matchExecution,
  parseSymbols,
  postFieldEntries,
  postLanguageIssues,
  validateComment,
  validatePostFields,
  validatePostInput,
  verifiedSymbol,
} from "./posts";

describe("parseSymbols", () => {
  it("normalizes, dedupes, and caps the list", () => {
    expect(parseSymbols("spy, $qqq  NIFTY spy")).toEqual(["SPY", "QQQ", "NIFTY"]);
    expect(parseSymbols("a b c d e f g")).toHaveLength(5);
  });

  it("drops junk tokens", () => {
    expect(parseSymbols("<script> ok")).toEqual(["OK"]);
  });
});

describe("postLanguageIssues", () => {
  it("flags signal calls and banned compliance phrases", () => {
    expect(postLanguageIssues("Buy NOW before the open, guaranteed")).toEqual(
      expect.arrayContaining(["buy now", "guaranteed"]),
    );
  });

  it("allows ordinary research language", () => {
    expect(postLanguageIssues("I bought SPY puts and sold them the next day.")).toEqual([]);
  });
});

describe("validatePostFields", () => {
  it("requires the type's required fields", () => {
    const result = validatePostFields("TRADE_THESIS", { horizon: "weeks" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["invalidation", "risks"]);
  });

  it("rejects select values outside the options", () => {
    const result = validatePostFields("MARKET_VIEW", { horizon: "forever", changeMind: "x" });
    expect(result.ok).toBe(false);
  });

  it("returns trimmed values when valid", () => {
    const result = validatePostFields("TRADE_REVIEW", { tradeDate: "2026-03-02", outcome: "  ok " });
    expect(result).toEqual({ ok: true, values: { tradeDate: "2026-03-02", outcome: "ok" } });
  });
});

describe("matchExecution", () => {
  const rows = [
    { id: "a", symbol: "AAPL", tradeDate: "2026-03-02" },
    { id: "b", symbol: "SPY 260320C00600000", tradeDate: "2026-03-03" },
    { id: "c", symbol: "NIFTY26MARFUT", tradeDate: "2026-03-04" },
    { id: "d", symbol: "SPYG", tradeDate: "2026-03-03" },
  ];

  it("matches the exact symbol on the same day", () => {
    expect(matchExecution(rows, "aapl", "2026-03-02")).toBe("a");
  });

  it("does not match a different day", () => {
    expect(matchExecution(rows, "AAPL", "2026-03-03")).toBeNull();
  });

  it("matches option and future rows to their underlying", () => {
    expect(matchExecution(rows, "SPY", "2026-03-03")).toBe("b");
    expect(matchExecution(rows, "NIFTY", "2026-03-04")).toBe("c");
  });

  it("does not match a different ticker sharing a prefix", () => {
    expect(matchExecution([rows[3]], "SPY", "2026-03-03")).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("03/02/2026")).toBe(false);
  });
});

describe("validatePostInput", () => {
  const base = {
    type: "RESEARCH",
    title: "Opening-range study",
    body: "Ten years of ES opening ranges.",
    symbols: "",
    fields: { method: "Minute bars, 2015-2025" },
  };

  it("returns the cleaned post when valid", () => {
    const result = validatePostInput(base, "2026-09-24");
    expect(result).toEqual({
      ok: true,
      post: {
        type: "RESEARCH",
        title: "Opening-range study",
        body: "Ten years of ES opening ranges.",
        symbols: [],
        fields: { method: "Minute bars, 2015-2025" },
      },
    });
  });

  it("rejects an unknown type", () => {
    const result = validatePostInput({ ...base, type: "SIGNAL" });
    expect(result.ok).toBe(false);
  });

  it("requires a symbol when the type needs one", () => {
    const result = validatePostInput(
      { ...base, type: "TRADE_THESIS", fields: { horizon: "weeks", invalidation: "x", risks: "y" } },
      "2026-09-24",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.symbols).toBeDefined();
  });

  it("prefixes type-field errors with the form field prefix", () => {
    const result = validatePostInput({ ...base, fields: {} }, "2026-09-24");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors[`${FIELD_PREFIX}method`]).toBeDefined();
  });

  it("enforces title and body limits", () => {
    const result = validatePostInput({ ...base, title: "x".repeat(141), body: "   " }, "2026-09-24");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["body", "title"]);
  });

  it("rejects future trade-review dates beyond one day of slack", () => {
    const review = {
      ...base,
      type: "TRADE_REVIEW",
      symbols: "SPY",
      fields: { tradeDate: "2026-09-27", outcome: "Stopped out" },
    };
    expect(validatePostInput(review, "2026-09-24").ok).toBe(false);
    expect(validatePostInput({ ...review, fields: { ...review.fields, tradeDate: "2026-09-25" } }, "2026-09-24").ok).toBe(true);
  });

  it("rejects signal language anywhere in the post, including structured fields", () => {
    const inBody = validatePostInput({ ...base, body: "Buy now, sure shot" }, "2026-09-24");
    expect(inBody.ok).toBe(false);
    if (!inBody.ok) expect(inBody.error).toContain("buy now");
    const inField = validatePostInput({ ...base, fields: { method: "join my paid group" } }, "2026-09-24");
    expect(inField.ok).toBe(false);
  });
});

describe("validateComment", () => {
  it("trims and accepts discussion", () => {
    expect(validateComment("  good write-up ")).toEqual({ ok: true, body: "good write-up" });
  });

  it("rejects empty, overlong, and signal comments", () => {
    expect(validateComment("   ").ok).toBe(false);
    expect(validateComment("x".repeat(2001)).ok).toBe(false);
    expect(validateComment("copy this trade").ok).toBe(false);
  });
});

describe("postFieldEntries", () => {
  it("labels fields in definition order and resolves select labels", () => {
    expect(postFieldEntries("MARKET_VIEW", { changeMind: "A close above 20d high", horizon: "weeks" })).toEqual([
      { key: "horizon", label: "Horizon", value: "Weeks" },
      { key: "changeMind", label: "What would change this view", value: "A close above 20d high" },
    ]);
  });

  it("ignores unknown keys and non-object input", () => {
    expect(postFieldEntries("RESEARCH", { junk: "x" })).toEqual([]);
    expect(postFieldEntries("RESEARCH", null)).toEqual([]);
  });
});

describe("matchAnySymbol / verifiedSymbol", () => {
  const rows = [
    { id: "a", symbol: "QQQ", tradeDate: "2026-03-02" },
    { id: "b", symbol: "SPY 260320C00600000", tradeDate: "2026-03-02" },
  ];

  it("returns the first genuine match across symbols", () => {
    expect(matchAnySymbol(rows, ["IWM", "SPY"], "2026-03-02")).toBe("b");
    expect(matchAnySymbol(rows, ["IWM"], "2026-03-02")).toBeNull();
    expect(matchAnySymbol(rows, ["SPY"], "2026-03-03")).toBeNull();
  });

  it("names the post symbol that matched", () => {
    expect(verifiedSymbol(["IWM", "SPY"], { symbol: "SPY 260320C00600000", tradeDate: "2026-03-02" })).toBe("SPY");
    expect(verifiedSymbol([], { symbol: "qqq", tradeDate: "2026-03-02" })).toBe("QQQ");
  });
});

describe("flagReason", () => {
  it("builds a stored reason from a known key", () => {
    expect(flagReason("spam", "")).toBe("Spam");
    expect(flagReason("other", "  off-topic ")).toBe("Other: off-topic");
    expect(flagReason("nope", "x")).toBeNull();
  });
});
