import { describe, expect, it } from "vitest";
import {
  coverageRange,
  formatDay,
  formatSignedPercent,
  gapSummary,
  hashPrefix,
  hiddenSectionSet,
  importRows,
  pairedFigures,
  parseTab,
  parseVersionParam,
  profileDescription,
  profileHref,
  provenanceLine,
  resolveSiteOrigin,
  safeExternalHref,
  truncate,
  yearsTradingLabel,
} from "./profile-page";

describe("tabs", () => {
  it("parses known tabs and falls back to overview", () => {
    expect(parseTab("performance")).toBe("performance");
    expect(parseTab(["proof", "posts"])).toBe("proof");
    expect(parseTab("leaderboard")).toBe("overview");
    expect(parseTab(undefined)).toBe("overview");
  });

  it("parses version params strictly", () => {
    expect(parseVersionParam("3")).toBe(3);
    expect(parseVersionParam(["12"])).toBe(12);
    expect(parseVersionParam("0")).toBeNull();
    expect(parseVersionParam("-1")).toBeNull();
    expect(parseVersionParam("2.5")).toBeNull();
    expect(parseVersionParam("abc")).toBeNull();
    expect(parseVersionParam("9999999999")).toBeNull();
    expect(parseVersionParam(undefined)).toBeNull();
  });

  it("builds tab links", () => {
    expect(profileHref("demo")).toBe("/p/demo");
    expect(profileHref("demo", "performance")).toBe("/p/demo?tab=performance");
    expect(profileHref("demo", "proof", 4)).toBe("/p/demo?tab=proof&v=4");
    // versions only apply to the proof tab
    expect(profileHref("demo", "posts", 4)).toBe("/p/demo?tab=posts");
    expect(profileHref("a b")).toBe("/p/a%20b");
  });
});

describe("hiddenSectionSet", () => {
  it("keeps only known section keys", () => {
    const set = hiddenSectionSet(["performance", "bogus", "credentials"]);
    expect(set.has("performance")).toBe(true);
    expect(set.has("credentials")).toBe(true);
    expect(set.size).toBe(2);
    expect(hiddenSectionSet(null).size).toBe(0);
  });
});

describe("dates and labels", () => {
  it("formats calendar dates in UTC", () => {
    expect(formatDay("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDay(new Date("2026-09-01T00:00:00Z"))).toBe("Sep 1, 2026");
    expect(formatDay("not a date")).toBe("Unknown date");
  });

  it("formats coverage windows", () => {
    expect(coverageRange("2025-01-03", "2026-08-29")).toBe("Jan 3, 2025 – Aug 29, 2026");
    expect(coverageRange("2026-01-02", "2026-01-02")).toBe("Jan 2, 2026");
    expect(coverageRange(null, "2026-01-02")).toBe("Coverage unavailable");
  });

  it("labels years trading", () => {
    expect(yearsTradingLabel(1)).toBe("1 yr trading");
    expect(yearsTradingLabel(8)).toBe("8 yrs trading");
    expect(yearsTradingLabel(0)).toBe("Under 1 yr trading");
    expect(yearsTradingLabel(null)).toBeNull();
  });

  it("builds the provenance line", () => {
    expect(
      provenanceLine({
        source: "Imported trading history",
        coverageStart: "2025-01-03",
        coverageEnd: "2026-08-29",
        versionNumber: 4,
        publishedAt: "2026-09-01T10:00:00.000Z",
      }),
    ).toBe("Computed from Imported trading history · Jan 3, 2025 – Aug 29, 2026 · version 4 published Sep 1, 2026");
  });
});

describe("figures", () => {
  it("signs percentages", () => {
    expect(formatSignedPercent(0.1234)).toBe("+12.3%");
    expect(formatSignedPercent(-0.04)).toBe("-4.0%");
    expect(formatSignedPercent(0)).toBe("0.0%");
    expect(formatSignedPercent(-0.00001)).toBe("0.0%");
  });

  it("never returns a period return without its drawdown", () => {
    expect(pairedFigures({ performanceHidden: false, returnPct: 0.12, maxDrawdownPct: 8.14 })).toEqual({
      periodReturn: "+12.0%",
      maxDrawdown: "8.1%",
    });
    expect(pairedFigures({ performanceHidden: false, returnPct: 0.12, maxDrawdownPct: null })).toBeNull();
    expect(pairedFigures({ performanceHidden: false, returnPct: null, maxDrawdownPct: 5 })).toBeNull();
    expect(pairedFigures({ performanceHidden: true, returnPct: 0.12, maxDrawdownPct: 5 })).toBeNull();
    expect(pairedFigures({ performanceHidden: false, returnPct: Number.NaN, maxDrawdownPct: 5 })).toBeNull();
  });

  it("summarizes coverage gaps", () => {
    expect(gapSummary([])).toBe("No gaps longer than 10 days between recorded trading days");
    expect(
      gapSummary([
        { from: "2026-01-02", to: "2026-02-02", days: 30 },
        { from: "2026-03-01", to: "2026-03-17", days: 15 },
      ]),
    ).toBe("2 gaps · 45 calendar days without records");
  });
});

describe("import history", () => {
  const batch = (over: Partial<Parameters<typeof importRows>[0][number]>) => ({
    id: "b1",
    source: "CSV",
    broker: "Interactive Brokers",
    rowCount: 120,
    fileHash: "ABCDEF0123456789abcdef",
    periodStart: new Date("2026-01-02T00:00:00Z"),
    periodEnd: new Date("2026-03-31T00:00:00Z"),
    createdAt: new Date("2026-04-01T12:00:00Z"),
    ...over,
  });

  it("orders newest first and shortens hashes", () => {
    const rows = importRows(
      [batch({ id: "old", createdAt: new Date("2026-01-01T00:00:00Z") }), batch({ id: "new" })],
      { hideBrokers: false },
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
    expect(rows[0]).toMatchObject({
      importedAt: "Apr 1, 2026",
      source: "File import",
      broker: "Interactive Brokers",
      rows: 120,
      period: "Jan 2, 2026 – Mar 31, 2026",
      hashPrefix: "abcdef012345",
    });
  });

  it("drops broker names when the trader hides them", () => {
    expect(importRows([batch({})], { hideBrokers: true })[0].broker).toBeNull();
  });

  it("guards malformed hashes", () => {
    expect(hashPrefix("not-a-hash")).toBe("unavailable");
    expect(hashPrefix(null)).toBe("unavailable");
  });
});

describe("metadata helpers", () => {
  it("truncates on word boundaries", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("alpha beta gamma delta", 15)).toBe("alpha beta…");
    expect(truncate("a   b\n c", 20)).toBe("a b c");
  });

  it("describes a profile from headline, source and coverage", () => {
    expect(
      profileDescription({
        displayName: "Demo",
        headline: "Systematic futures trader.",
        strategy: "Trend",
        source: "Imported trading history",
        coverage: "Jan 2025 – Aug 2026",
      }),
    ).toBe(
      "Systematic futures trader. Published record: Imported trading history, Jan 2025 – Aug 2026. Research profile on TrustSVAN.",
    );
    expect(
      profileDescription({ displayName: "Demo", headline: null, strategy: "  ", source: null, coverage: null }),
    ).toBe("Demo's trading record. No published record yet. Research profile on TrustSVAN.");
    expect(
      profileDescription({ displayName: "D", headline: "x".repeat(400), strategy: null, source: null, coverage: null })
        .length,
    ).toBeLessThanOrEqual(200);
  });

  it("resolves the site origin in priority order", () => {
    expect(resolveSiteOrigin({ configured: "https://trustsvan.com/some/path", host: "evil.test" })).toBe(
      "https://trustsvan.com",
    );
    expect(resolveSiteOrigin({ vercelProductionHost: "trustsvan.vercel.app", host: "x.test" })).toBe(
      "https://trustsvan.vercel.app",
    );
    expect(resolveSiteOrigin({ host: "localhost:3000" })).toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ host: "preview.example.com", proto: "https" })).toBe("https://preview.example.com");
    expect(resolveSiteOrigin({ host: "bad host/<x>" })).toBeNull();
    expect(resolveSiteOrigin({ configured: "javascript:alert(1)", host: null })).toBeNull();
  });

  it("only allows safe contact links", () => {
    expect(safeExternalHref("https://cal.com/me")).toBe("https://cal.com/me");
    expect(safeExternalHref("mailto:me@example.com")).toBe("mailto:me@example.com");
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("cal.com/me")).toBeNull();
    expect(safeExternalHref("")).toBeNull();
  });
});
