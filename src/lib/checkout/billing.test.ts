import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { safeNextPath } from "@/lib/safe-path";
import { accountNumber, billingSchema, planAmount, startingPlan } from "./billing";
import { checkoutModeFor, staffEmails } from "./config";
import { DEMO_CREDIT, demoCreditLeft } from "./demo";

const valid = { name: "Aditya Nalluri", phone: "98765 43210", state: "Telangana", terms: "on" };

describe("checkout details", () => {
  it("accepts an Indian mobile in common formats and stores it with +91", () => {
    for (const phone of ["98765 43210", "+91 98765-43210", "919876543210", "9876543210"]) {
      const parsed = billingSchema.safeParse({ ...valid, phone });
      expect(parsed.success && parsed.data.phone).toBe("+919876543210");
    }
  });

  it("rejects bad numbers, unknown states, short names and unticked terms", () => {
    const errors = (input: Record<string, unknown>) => {
      const parsed = billingSchema.safeParse(input);
      return parsed.success ? {} : parsed.error.flatten().fieldErrors;
    };
    expect(errors({ ...valid, phone: "58765 43210" }).phone).toEqual(["Enter a 10-digit Indian mobile number."]);
    expect(errors({ ...valid, phone: "98765" }).phone).toBeDefined();
    expect(errors({ ...valid, state: "Narnia" }).state).toEqual(["Choose your state."]);
    expect(errors({ ...valid, name: "A" }).name).toEqual(["Enter your full name."]);
    expect(errors({ ...valid, terms: null }).terms).toEqual(["Accept the rules and terms to continue."]);
  });

  it("charges the plan's GST-inclusive fee in paise and numbers accounts readably", () => {
    expect(planAmount(findEvaluationPlan("1l")!)).toBe(2_999_00);
    expect(planAmount(findEvaluationPlan("10l")!)).toBe(14_999_00);
    expect(accountNumber("evmgx1k2abc123def456", "2-5l")).toBe("WSV-25L-DEF456");
  });
});

describe("starting size", () => {
  it("opens checkout on the recommended size, or the largest one the demo credit still covers", () => {
    expect(startingPlan().id).toBe("5l");
    expect(startingPlan(null).id).toBe("5l");
    expect(startingPlan(DEMO_CREDIT * 100).id).toBe("5l");
    expect(startingPlan(8_999_00).id).toBe("5l");
    expect(startingPlan(8_998_00).id).toBe("1l");
    expect(startingPlan(5_003_00).id).toBe("1l");
    expect(startingPlan(2_999_00).id).toBe("1l");
    // Nothing affordable: stay on the recommended size, which checkout shows as short of credit.
    expect(startingPlan(1_000_00).id).toBe("5l");
  });
});

describe("checkout mode", () => {
  const env = { STAFF_EMAILS: " Founder@WhiteSVAN.in , ops@whitesvan.in" };

  it("lets staff make test purchases and everyone else buy demo evaluations, or none with demo off", () => {
    expect(staffEmails(env)).toEqual(["founder@whitesvan.in", "ops@whitesvan.in"]);
    expect(checkoutModeFor("FOUNDER@whitesvan.in", env)).toBe("test");
    expect(checkoutModeFor("trader@example.com", env)).toBe("demo");
    expect(checkoutModeFor(null, env)).toBe("demo");
    expect(checkoutModeFor("founder@whitesvan.in", {})).toBe("demo");
    expect(checkoutModeFor("trader@example.com", env, false)).toBe("closed");
    expect(checkoutModeFor("FOUNDER@whitesvan.in", env, false)).toBe("test");
  });

  it("counts demo credit down from the allowance and never below zero", () => {
    expect(demoCreditLeft(0)).toBe(DEMO_CREDIT * 100);
    expect(demoCreditLeft(planAmount(findEvaluationPlan("10l")!))).toBe(DEMO_CREDIT * 100 - 14_999_00);
    expect(demoCreditLeft(DEMO_CREDIT * 100 + 1)).toBe(0);
  });
});

describe("return paths", () => {
  it("keeps paths on this site only", () => {
    for (const path of ["/trade/ev123", "/checkout/1l", "/markets?feed=connected", "/"]) expect(safeNextPath(path)).toBe(path);
    for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "trade/ev123", "/a b", `/${"x".repeat(200)}`, "", null, undefined]) {
      expect(safeNextPath(path)).toBeNull();
    }
  });
});
