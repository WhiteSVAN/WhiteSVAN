import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, findAccountPlan, findEvaluationPlan, formatInr, planLimits, PROGRAMME_STEPS, RECOMMENDED_PLAN, RULE_GROUPS, rulesInBrief } from "./prop-firm";

describe("published evaluation preview", () => {
  it("sells three sizes with their rupee targets and limits", () => {
    expect(EVALUATION_PLANS.map((plan) => ({ id: plan.id, fee: plan.fee, ...planLimits(plan) }))).toEqual([
      { id: "1l", fee: 2999, profitTarget: 6000, maximumLoss: 4000, dailyLoss: 2000 },
      { id: "5l", fee: 8999, profitTarget: 30000, maximumLoss: 20000, dailyLoss: 10000 },
      { id: "10l", fee: 14999, profitTarget: 60000, maximumLoss: 40000, dailyLoss: 20000 },
    ]);
  });

  it("stops selling ₹2.5L but keeps it for accounts already opened on it", () => {
    expect(findEvaluationPlan("2-5l")).toBeUndefined();
    expect(findAccountPlan("2-5l")?.label).toBe("₹2.5L");
    expect(findAccountPlan("5l")).toBe(findEvaluationPlan("5l"));
    expect(findAccountPlan("unlimited")).toBeUndefined();
  });

  it("does not silently select a plan for an invalid detail URL", () => {
    expect(findEvaluationPlan("5l")?.balance).toBe(500000);
    expect(findEvaluationPlan("unlimited")).toBeUndefined();
  });

  it("recommends the middle size", () => {
    expect(RECOMMENDED_PLAN).toBe(EVALUATION_PLANS[1]);
    expect(RECOMMENDED_PLAN.id).toBe("5l");
  });

  it("explains the programme in three steps", () => {
    expect(PROGRAMME_STEPS.map(({ title }) => title)).toEqual(["Pass the evaluation", "Get funded", "Get paid"]);
  });

  it("formats Indian rupee grouping without shortening the disclosed amount", () => {
    expect(formatInr(100000)).toBe("₹1,00,000");
  });
});

describe("the rulebook", () => {
  const rules = RULE_GROUPS.flatMap((group) => group.rules);

  it("groups every rule in threes, with anchors that older links still reach", () => {
    expect(RULE_GROUPS.map((group) => [group.id, group.title, group.rules.length])).toEqual([
      ["evaluation", "To pass", 3],
      ["limits", "To keep your account", 3],
      ["desk", "To get paid", 3],
      ["markets", "On the platform", 3],
    ]);
    const anchors = [...RULE_GROUPS.map((group) => group.id), ...rules.map((rule) => rule.id)];
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const anchor of ["evaluation", "drawdown", "markets", "sessions", "conduct", "desk"]) expect(anchors).toContain(anchor);
  });

  it("puts each size's own amounts into the plain words", () => {
    const five = findEvaluationPlan("5l")!;
    const plain = Object.fromEntries(rules.map((rule) => [rule.id, rule.plain(five)]));
    expect(plain.target).toBe("Make ₹30,000 profit: 6% of your ₹5,00,000 starting balance.");
    expect(plain["daily-loss"]).toContain("₹10,000");
    expect(plain.drawdown).toContain("₹20,000");
    expect(plain.drawdown).toContain("₹4,80,000");
    expect(plain.consistency).toContain("₹15,000 or less");
    expect(plain.payouts).toBe("Withdraw whenever your profit is above the ₹20,000 buffer, up to ₹25,000 a payout.");
    expect(plain.products).toContain("up to 4 lots open at once");
    for (const plan of EVALUATION_PLANS) {
      const limits = planLimits(plan);
      const figures = Object.fromEntries(rules.map((rule) => [rule.id, rule.figure(plan)]));
      expect(figures.target).toBe(formatInr(limits.profitTarget));
      expect(figures["daily-loss"]).toBe(formatInr(limits.dailyLoss));
      expect(figures.drawdown).toBe(formatInr(limits.maximumLoss));
    }
  });

  it("walks the drawdown floor up to the starting balance in the example", () => {
    const example = rules.find((rule) => rule.id === "drawdown")!.example!(findEvaluationPlan("1l")!);
    expect(example).toBe("You start at ₹1,00,000, so your floor is ₹96,000. Close a day at ₹1,02,000 and it moves up to ₹98,000. Once you close a day at ₹1,04,000 or more, the floor locks at ₹1,00,000 for good.");
  });

  it("sums up in three lines", () => {
    expect(rulesInBrief(findEvaluationPlan("10l")!)).toEqual([
      { title: "Pass", text: "Make ₹60,000 in at least 2 trading days, with no single day over half of it." },
      { title: "Keep your account", text: "Don't lose ₹20,000 in a day, or fall ₹40,000 below your highest closing balance." },
      { title: "Get paid", text: "Keep 80% of the profit above a ₹40,000 buffer, up to ₹50,000 a payout." },
    ]);
  });
});
