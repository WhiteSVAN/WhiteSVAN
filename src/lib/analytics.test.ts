import { describe, expect, it } from "vitest";
import {
  conversionRate,
  countSince,
  formatRate,
  ratio,
  summarizeInquiries,
  summarizeViewers,
  toAnalyticsWindow,
  viewsPerDay,
  windowStart,
} from "./analytics";

const NOW = new Date("2026-09-24T15:30:00Z");

describe("windows", () => {
  it("accepts 30 or 90 and defaults to 30", () => {
    expect(toAnalyticsWindow("90")).toBe(90);
    expect(toAnalyticsWindow("30")).toBe(30);
    expect(toAnalyticsWindow("7")).toBe(30);
    expect(toAnalyticsWindow(undefined)).toBe(30);
  });

  it("starts the window at UTC midnight, inclusive of today", () => {
    expect(windowStart(30, NOW).toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(windowStart(1, NOW).toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });
});

describe("viewsPerDay", () => {
  it("zero-fills every day when there is no data", () => {
    const series = viewsPerDay([], 30, NOW);
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-08-26", views: 0 });
    expect(series[29]).toEqual({ date: "2026-09-24", views: 0 });
    expect(series.every((d) => d.views === 0)).toBe(true);
  });

  it("counts rows per day and ignores rows outside the window", () => {
    const series = viewsPerDay(
      [
        { day: new Date("2026-09-24T00:00:00Z"), viewerKey: "u:1" },
        { day: new Date("2026-09-24T00:00:00Z"), viewerKey: "a:x" },
        { day: "2026-09-20", viewerKey: "u:1" },
        { day: "2026-01-01", viewerKey: "u:1" },
      ],
      30,
      NOW,
    );
    expect(series.find((d) => d.date === "2026-09-24")?.views).toBe(2);
    expect(series.find((d) => d.date === "2026-09-20")?.views).toBe(1);
    expect(series.reduce((n, d) => n + d.views, 0)).toBe(3);
  });
});

describe("summarizeViewers", () => {
  it("handles empty data", () => {
    expect(summarizeViewers([])).toEqual({
      views: 0,
      uniqueViewers: 0,
      signedInViewers: 0,
      anonymousViewers: 0,
    });
  });

  it("dedupes viewers across days and splits signed-in vs anonymous", () => {
    const s = summarizeViewers([
      { day: "2026-09-01", viewerKey: "u:alice", viewerId: "alice" },
      { day: "2026-09-02", viewerKey: "u:alice", viewerId: "alice" },
      { day: "2026-09-02", viewerKey: "u:bob", viewerId: null }, // user since deleted
      { day: "2026-09-02", viewerKey: "a:hash1" },
      { day: "2026-09-03", viewerKey: "a:hash1" },
      { day: "2026-09-03", viewerKey: "a:hash2" },
    ]);
    expect(s).toEqual({ views: 6, uniqueViewers: 4, signedInViewers: 2, anonymousViewers: 2 });
  });
});

describe("ratios", () => {
  it("returns null on division by zero", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(1, Number.NaN)).toBeNull();
    expect(conversionRate(5, 0)).toBeNull();
  });

  it("divides normally otherwise", () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(conversionRate(2, 40)).toBe(0.05);
  });

  it("formats rates", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.25)).toBe("25%");
    expect(formatRate(0.125)).toBe("12.5%");
    expect(formatRate(0)).toBe("0%");
  });
});

describe("summarizeInquiries", () => {
  it("handles no inquiries", () => {
    expect(summarizeInquiries([])).toEqual({
      total: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      ignored: 0,
      responded: 0,
      acceptanceRate: null,
    });
  });

  it("has no acceptance rate while everything is pending", () => {
    const s = summarizeInquiries([{ status: "PENDING" }, { status: "PENDING" }]);
    expect(s.pending).toBe(2);
    expect(s.acceptanceRate).toBeNull();
  });

  it("computes acceptance over answered requests", () => {
    const s = summarizeInquiries([
      { status: "ACCEPTED" },
      { status: "ACCEPTED" },
      { status: "DECLINED" },
      { status: "IGNORED" },
      { status: "PENDING" },
    ]);
    expect(s).toMatchObject({ total: 5, accepted: 2, declined: 1, ignored: 1, responded: 4 });
    expect(s.acceptanceRate).toBe(0.5);
  });
});

describe("countSince", () => {
  it("counts timestamps on or after the cutoff", () => {
    const since = new Date("2026-09-01T00:00:00Z");
    expect(countSince([], since)).toBe(0);
    expect(
      countSince(
        [new Date("2026-08-31T23:59:59Z"), new Date("2026-09-01T00:00:00Z"), new Date("2026-09-10T00:00:00Z")],
        since,
      ),
    ).toBe(2);
  });
});
