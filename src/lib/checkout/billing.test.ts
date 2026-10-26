import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { safeNextPath } from "@/lib/safe-path";
import { accountNumber, billingSchema, planAmount } from "./billing";
import { checkoutModeFor, staffEmails } from "./config";

const valid = { phone: "98765 43210", state: "Telangana" };

describe("checkout details", () => {
  it("accepts an Indian mobile in common formats and stores it with +91", () => {
    for (const phone of ["98765 43210", "+91 98765-43210", "919876543210", "9876543210"]) {
      const parsed = billingSchema.safeParse({ ...valid, phone });
      expect(parsed.success && parsed.data.phone).toBe("+919876543210");
    }
  });

  it("rejects bad numbers and unknown states", () => {
    const errors = (input: Record<string, unknown>) => {
      const parsed = billingSchema.safeParse(input);
      return parsed.success ? {} : parsed.error.flatten().fieldErrors;
    };
    expect(errors({ ...valid, phone: "58765 43210" }).phone).toEqual(["Enter a 10-digit Indian mobile number."]);
    expect(errors({ ...valid, phone: "98765" }).phone).toBeDefined();
    expect(errors({ ...valid, state: "Narnia" }).state).toEqual(["Choose your state."]);
    expect(errors({ phone: "98765 43210" }).state).toEqual(["Choose your state."]);
    expect(errors(valid)).toEqual({});
  });

  it("charges the plan's GST-inclusive fee in paise and numbers accounts readably", () => {
    expect(planAmount(findEvaluationPlan("1l")!)).toBe(2_999_00);
    expect(planAmount(findEvaluationPlan("10l")!)).toBe(14_999_00);
    expect(accountNumber("evmgx1k2abc123def456", "2-5l")).toBe("WSV-25L-DEF456");
  });
});

describe("checkout mode", () => {
  const env = { STAFF_EMAILS: " Founder@WhiteSVAN.in , ops@whitesvan.in" };

  const razorpay = { RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "secret" };

  it("takes payment through Razorpay once both keys are set, and starts free until then", () => {
    expect(checkoutModeFor("trader@example.com", env)).toBe("free");
    expect(checkoutModeFor(null, {})).toBe("free");
    expect(checkoutModeFor("trader@example.com", { ...env, RAZORPAY_KEY_ID: "rzp_test_key" })).toBe("free");
    expect(checkoutModeFor("trader@example.com", { ...env, ...razorpay })).toBe("razorpay");
    expect(checkoutModeFor("trader@example.com", { ...env, RAZORPAY_KEY_ID: " ", RAZORPAY_KEY_SECRET: "secret" })).toBe("free");
  });

  it("lets staff make test purchases in every mode", () => {
    expect(staffEmails(env)).toEqual(["founder@whitesvan.in", "ops@whitesvan.in"]);
    expect(checkoutModeFor("FOUNDER@whitesvan.in", env)).toBe("test");
    expect(checkoutModeFor("ops@whitesvan.in", { ...env, ...razorpay })).toBe("test");
    expect(checkoutModeFor("founder@whitesvan.in", {})).toBe("free");
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
