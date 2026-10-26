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

  it("gives the three steps to an evaluation, all on the checkout screen", () => {
    const answer = HELP_TOPICS.flatMap((t) => t.articles).find((a) => a.id === "how-to-start")?.answer ?? "";
    expect(answer).toMatch(/^On one screen, in three steps: create your account \(with Google, or an email and password\), choose your account size \(₹1L to ₹10L\) and check out/);
    expect(answer).toContain("opens on the trading platform straight away");
  });

  it("keeps rule answers short and links them to the rulebook", () => {
    const rules = HELP_TOPICS.find((t) => t.id === "rules")!.articles;
    for (const article of rules.filter((a) => a.id !== "tips")) expect(article.link?.href).toMatch(/^\/rules#[a-z-]+$/);
  });

  it("opens the funded account on a pass, with KYC before the first payout", () => {
    const answer = HELP_TOPICS.flatMap((t) => t.articles).find((a) => a.id === "after-passing")?.answer ?? "";
    expect(answer).toContain("Your funded account opens as soon as you pass");
    expect(answer).toContain("Before your first payout, complete KYC");
    expect(allAnswers).not.toMatch(/launching soon|early access|demo credit|virtual credit/i);
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
    const result = searchHelp(HELP_TOPICS, "payouts deposit");
    expect(result.map((t) => t.id)).toEqual(["payouts"]);
  });

  it("keeps to three topics", () => {
    expect(HELP_TOPICS.map((t) => t.id)).toEqual(["evaluations", "rules", "payouts"]);
  });

  it("returns nothing when no article matches", () => {
    expect(searchHelp(HELP_TOPICS, "crypto margin call")).toEqual([]);
  });
});
