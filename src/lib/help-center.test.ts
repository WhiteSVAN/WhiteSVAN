import { describe, expect, it } from "vitest";
import { HELP_TOPICS, searchHelp } from "./help-center";
import { EVALUATION_PLANS, PROGRAMME_RULES, formatInr } from "./prop-firm";

const allAnswers = HELP_TOPICS.flatMap((t) => t.articles.map((a) => a.answer)).join(" ");

describe("HELP_TOPICS", () => {
  it("uses unique ids for topics and articles (they are page anchors)", () => {
    const ids = HELP_TOPICS.flatMap((t) => [t.id, ...t.articles.map((a) => a.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("takes rule figures from the rulebook", () => {
    expect(allAnswers).toContain(`${PROGRAMME_RULES.targetPercent}% profit target`);
    expect(allAnswers).toContain(`You keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit`);
    for (const plan of EVALUATION_PLANS) expect(allAnswers).toContain(formatInr(plan.payoutCap));
  });

  it("works through the trailing max drawdown on the smallest account", () => {
    // ₹1L account, 4%: the floor starts at ₹96,000 and locks at ₹1,00,000.
    expect(allAnswers).toContain(`floor starts at ${formatInr(96_000)} and locks at ${formatInr(100_000)}`);
  });

  it("never promises returns", () => {
    for (const phrase of ["guaranteed returns", "risk-free", "will make money", "assured profits"]) {
      expect(allAnswers.toLowerCase()).not.toContain(phrase);
    }
  });
});

describe("searchHelp", () => {
  it("returns every topic for an empty query", () => {
    expect(searchHelp(HELP_TOPICS, "   ")).toHaveLength(HELP_TOPICS.length);
  });

  it("matches every word, case-insensitively, and drops empty topics", () => {
    const result = searchHelp(HELP_TOPICS, "KYC aadhaar");
    const ids = result.flatMap((t) => t.articles.map((a) => a.id));
    expect(ids).toContain("who-can-join");
    expect(result.every((t) => t.articles.length > 0)).toBe(true);
  });

  it("matches on the topic title", () => {
    const result = searchHelp(HELP_TOPICS, "academy tips");
    expect(result.map((t) => t.id)).toEqual(["academy"]);
  });

  it("returns nothing when no article matches", () => {
    expect(searchHelp(HELP_TOPICS, "crypto margin call")).toEqual([]);
  });
});
