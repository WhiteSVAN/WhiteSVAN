import { describe, it, expect } from "vitest";
import {
  getFreshnessStatus,
  nextExpectedUpdate,
  calculateUpdateReliability,
  reliabilityFromFreshness,
  describeFreshness,
  toCadence,
} from "./freshness";

const now = new Date("2026-06-16T12:00:00Z");
/** A timestamp `hours` before `now`. */
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

describe("getFreshnessStatus", () => {
  it("manual cadence is always manual_only, regardless of age", () => {
    expect(getFreshnessStatus("manual", ago(0), now)).toBe("manual_only");
    expect(getFreshnessStatus("manual", ago(10_000), now)).toBe("manual_only");
    expect(getFreshnessStatus("manual", null, now)).toBe("manual_only");
  });

  it("never-published (non-manual) is 'never'", () => {
    expect(getFreshnessStatus("daily", null, now)).toBe("never");
    expect(getFreshnessStatus("weekly", null, now)).toBe("never");
  });

  it("daily: ≤48h fresh, ≤7d getting_stale, else stale", () => {
    expect(getFreshnessStatus("daily", ago(47), now)).toBe("fresh");
    expect(getFreshnessStatus("daily", ago(48), now)).toBe("fresh"); // boundary inclusive
    expect(getFreshnessStatus("daily", ago(49), now)).toBe("getting_stale");
    expect(getFreshnessStatus("daily", ago(168), now)).toBe("getting_stale"); // 7d boundary
    expect(getFreshnessStatus("daily", ago(169), now)).toBe("stale");
  });

  it("weekly: ≤9d fresh, ≤14d getting_stale, else stale", () => {
    expect(getFreshnessStatus("weekly", ago(216), now)).toBe("fresh"); // 9d
    expect(getFreshnessStatus("weekly", ago(217), now)).toBe("getting_stale");
    expect(getFreshnessStatus("weekly", ago(336), now)).toBe("getting_stale"); // 14d
    expect(getFreshnessStatus("weekly", ago(337), now)).toBe("stale");
  });

  it("monthly: ≤40d fresh, ≤60d getting_stale, else stale", () => {
    expect(getFreshnessStatus("monthly", ago(960), now)).toBe("fresh"); // 40d
    expect(getFreshnessStatus("monthly", ago(961), now)).toBe("getting_stale");
    expect(getFreshnessStatus("monthly", ago(1440), now)).toBe("getting_stale"); // 60d
    expect(getFreshnessStatus("monthly", ago(1441), now)).toBe("stale");
  });
});

describe("nextExpectedUpdate", () => {
  it("is the nominal interval after last publish", () => {
    const last = ago(0);
    expect(nextExpectedUpdate("daily", last)?.getTime()).toBe(last.getTime() + 24 * 3_600_000);
    expect(nextExpectedUpdate("weekly", last)?.getTime()).toBe(last.getTime() + 7 * 24 * 3_600_000);
    expect(nextExpectedUpdate("monthly", last)?.getTime()).toBe(last.getTime() + 30 * 24 * 3_600_000);
  });

  it("is null for manual or never-published", () => {
    expect(nextExpectedUpdate("manual", ago(0))).toBeNull();
    expect(nextExpectedUpdate("daily", null)).toBeNull();
  });
});

describe("calculateUpdateReliability", () => {
  it("returns 50 when nothing was expected yet", () => {
    expect(calculateUpdateReliability(0, 0)).toBe(50);
    expect(calculateUpdateReliability(-3, 5)).toBe(50);
  });

  it("is the completed/expected ratio, capped at 100", () => {
    expect(calculateUpdateReliability(10, 5)).toBe(50);
    expect(calculateUpdateReliability(4, 3)).toBe(75);
    expect(calculateUpdateReliability(4, 8)).toBe(100); // over-delivery capped
  });
});

describe("reliabilityFromFreshness", () => {
  it("rewards fresh profiles and penalizes stale ones", () => {
    expect(reliabilityFromFreshness("fresh")).toBe(100);
    expect(reliabilityFromFreshness("getting_stale")).toBe(60);
    expect(reliabilityFromFreshness("stale")).toBe(20);
    expect(reliabilityFromFreshness("manual_only")).toBe(50);
    expect(reliabilityFromFreshness("never")).toBe(40);
  });
});

describe("toCadence", () => {
  it("normalizes the Prisma enum (and junk) to lowercase, defaulting to manual", () => {
    expect(toCadence("DAILY")).toBe("daily");
    expect(toCadence("Weekly")).toBe("weekly");
    expect(toCadence("MONTHLY")).toBe("monthly");
    expect(toCadence(null)).toBe("manual");
    expect(toCadence("nonsense")).toBe("manual");
  });
});

describe("describeFreshness", () => {
  it("bundles status, label, tone, age and next-due", () => {
    const d = describeFreshness("daily", ago(24), now);
    expect(d.status).toBe("fresh");
    expect(d.label).toBe("Fresh");
    expect(d.tone).toBe("good");
    expect(d.ageHours).toBeCloseTo(24);
    expect(d.nextExpectedUpdate).not.toBeNull();
  });

  it("stale gets a 'bad' tone; manual stays neutral with no age", () => {
    expect(describeFreshness("daily", ago(500), now).tone).toBe("bad");
    const m = describeFreshness("manual", null, now);
    expect(m.tone).toBe("neutral");
    expect(m.ageHours).toBeNull();
  });
});
