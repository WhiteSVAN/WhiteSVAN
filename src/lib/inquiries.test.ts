import { describe, expect, it } from "vitest";
import {
  availableDecisions,
  canMessage,
  canRequestAgain,
  canTransition,
  inquiryStatusLabel,
  isDecision,
  requestAgainAt,
  validateInquiryMessage,
  INQUIRY_STATUSES,
  REQUEST_COOLDOWN_DAYS,
} from "./inquiries";

const DAY = 24 * 60 * 60 * 1000;

describe("canTransition", () => {
  it("lets a pending request be accepted, declined, or ignored", () => {
    expect(canTransition("PENDING", "ACCEPTED")).toBe(true);
    expect(canTransition("PENDING", "DECLINED")).toBe(true);
    expect(canTransition("PENDING", "IGNORED")).toBe(true);
  });

  it("lets an ignored request be accepted later, but nothing else", () => {
    expect(canTransition("IGNORED", "ACCEPTED")).toBe(true);
    expect(canTransition("IGNORED", "DECLINED")).toBe(false);
    expect(canTransition("IGNORED", "PENDING")).toBe(false);
  });

  it("treats accepted and declined as final", () => {
    for (const to of INQUIRY_STATUSES) {
      expect(canTransition("ACCEPTED", to)).toBe(false);
      expect(canTransition("DECLINED", to)).toBe(false);
    }
  });

  it("never allows a no-op or a move back to pending", () => {
    for (const s of INQUIRY_STATUSES) {
      expect(canTransition(s, s)).toBe(false);
      expect(canTransition(s, "PENDING")).toBe(false);
    }
  });
});

describe("availableDecisions / isDecision", () => {
  it("offers the buttons that match the transitions", () => {
    expect(availableDecisions("PENDING")).toEqual(["accept", "decline", "ignore"]);
    expect(availableDecisions("IGNORED")).toEqual(["accept"]);
    expect(availableDecisions("ACCEPTED")).toEqual([]);
    expect(availableDecisions("DECLINED")).toEqual([]);
  });

  it("only accepts known decisions", () => {
    expect(isDecision("accept")).toBe(true);
    expect(isDecision("toString")).toBe(false);
    expect(isDecision("ACCEPTED")).toBe(false);
    expect(isDecision(undefined)).toBe(false);
  });
});

describe("canMessage", () => {
  it("unlocks messaging only once accepted", () => {
    expect(canMessage("ACCEPTED")).toBe(true);
    expect(canMessage("PENDING")).toBe(false);
    expect(canMessage("DECLINED")).toBe(false);
    expect(canMessage("IGNORED")).toBe(false);
  });
});

describe("canRequestAgain", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("allows a first request", () => {
    expect(canRequestAgain(null, now)).toBe(true);
  });

  it("blocks while a request is pending or accepted", () => {
    const createdAt = new Date(now.getTime() - 400 * DAY);
    expect(canRequestAgain({ status: "PENDING", createdAt, respondedAt: null }, now)).toBe(false);
    expect(canRequestAgain({ status: "ACCEPTED", createdAt, respondedAt: createdAt }, now)).toBe(false);
    expect(requestAgainAt({ status: "PENDING", createdAt, respondedAt: null })).toBeNull();
  });

  it("waits the cooldown after a decline, counted from the response", () => {
    const createdAt = new Date(now.getTime() - 60 * DAY);
    const recent = new Date(now.getTime() - (REQUEST_COOLDOWN_DAYS - 1) * DAY);
    const old = new Date(now.getTime() - REQUEST_COOLDOWN_DAYS * DAY);
    expect(canRequestAgain({ status: "DECLINED", createdAt, respondedAt: recent }, now)).toBe(false);
    expect(canRequestAgain({ status: "DECLINED", createdAt, respondedAt: old }, now)).toBe(true);
  });

  it("applies the same cooldown to ignored requests", () => {
    const respondedAt = new Date(now.getTime() - 5 * DAY);
    expect(canRequestAgain({ status: "IGNORED", createdAt: respondedAt, respondedAt }, now)).toBe(false);
    expect(requestAgainAt({ status: "IGNORED", createdAt: respondedAt, respondedAt })?.getTime()).toBe(
      respondedAt.getTime() + REQUEST_COOLDOWN_DAYS * DAY,
    );
  });

  it("falls back to the request date when no response time was stored", () => {
    const createdAt = new Date(now.getTime() - 31 * DAY);
    expect(canRequestAgain({ status: "IGNORED", createdAt, respondedAt: null }, now)).toBe(true);
  });
});

describe("validateInquiryMessage", () => {
  it("enforces the request length window", () => {
    expect(validateInquiryMessage("too short", "request").ok).toBe(false);
    expect(validateInquiryMessage("x".repeat(1001), "request").ok).toBe(false);
    const ok = validateInquiryMessage("  I'd like to ask about your futures record coverage.  ", "request");
    expect(ok).toEqual({ ok: true, value: "I'd like to ask about your futures record coverage." });
  });

  it("enforces the message length window", () => {
    expect(validateInquiryMessage("   ", "message").ok).toBe(false);
    expect(validateInquiryMessage("ok", "message").ok).toBe(true);
    expect(validateInquiryMessage("y".repeat(2001), "message").ok).toBe(false);
    expect(validateInquiryMessage("y".repeat(2000), "message").ok).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(validateInquiryMessage(null, "message").ok).toBe(false);
    expect(validateInquiryMessage(42, "request").ok).toBe(false);
  });

  it("normalizes line endings and long blank runs", () => {
    const result = validateInquiryMessage("Line one\r\n\r\n\r\n\r\nLine two", "message");
    expect(result).toEqual({ ok: true, value: "Line one\n\nLine two" });
  });

  it("rejects signal, copy-trading, and advice language", () => {
    const signal = validateInquiryMessage("Can you share when to buy now so we can follow along?", "request");
    expect(signal.ok).toBe(false);
    if (!signal.ok) expect(signal.error).toContain("buy now");

    const banned = validateInquiryMessage("Is this a risk-free approach?", "message");
    expect(banned.ok).toBe(false);
    if (!banned.ok) expect(banned.error).toContain("risk-free");
  });

  it("allows ordinary diligence questions", () => {
    expect(
      validateInquiryMessage("How do you handle overnight gaps in your NIFTY options positions?", "request").ok,
    ).toBe(true);
  });
});

describe("inquiryStatusLabel", () => {
  it("phrases the status for each side", () => {
    expect(inquiryStatusLabel("PENDING", "client")).toBe("Request sent");
    expect(inquiryStatusLabel("IGNORED", "client")).toBe("No response");
    expect(inquiryStatusLabel("PENDING", "trader")).toBe("Awaiting your response");
    expect(inquiryStatusLabel("ACCEPTED", "trader")).toBe("Active");
  });
});
