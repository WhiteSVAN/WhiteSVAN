import { describe, expect, it } from "vitest";
import {
  REFERRAL_CODE_LENGTH,
  ReferralCodeExhaustedError,
  allocateReferralCode,
  generateReferralCode,
  isReferralCode,
  normalizeReferralCode,
  referralLink,
} from "./referral";

describe("generateReferralCode", () => {
  it("produces 8 lowercase alphanumeric characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect(code).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  it("maps bytes onto the alphabet and skips biased bytes", () => {
    // 255 and 252 are >= 252 (the unbiased limit) and must be skipped.
    const bytes = [255, 0, 252, 1, 25, 26, 35, 36, 71, 2, 3, 4, 5, 6, 7, 8];
    const code = generateReferralCode((n) => Uint8Array.from(bytes.slice(0, n)));
    expect(code).toBe("abz09a9c");
  });

  it("keeps drawing until it has enough unbiased bytes", () => {
    let call = 0;
    const code = generateReferralCode((n) => {
      call++;
      return call === 1 ? new Uint8Array(n).fill(253) : new Uint8Array(n).fill(1);
    });
    expect(code).toBe("bbbbbbbb");
    expect(call).toBe(2);
  });
});

describe("validation", () => {
  it("accepts only 8-char [a-z0-9] codes", () => {
    expect(isReferralCode("abcd1234")).toBe(true);
    expect(isReferralCode("ABCD1234")).toBe(false);
    expect(isReferralCode("abc123")).toBe(false);
    expect(isReferralCode("abcd-234")).toBe(false);
    expect(isReferralCode(12345678)).toBe(false);
  });

  it("normalizes untrusted input", () => {
    expect(normalizeReferralCode("  ABCD1234 ")).toBe("abcd1234");
    expect(normalizeReferralCode("abcd12345")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });
});

describe("allocateReferralCode", () => {
  it("retries on collision and returns the first code that sticks", async () => {
    const taken = new Set(["aaaaaaaa", "bbbbbbbb"]);
    const queue = ["aaaaaaaa", "bbbbbbbb", "cccccccc"];
    const code = await allocateReferralCode(async (c) => !taken.has(c), {
      generate: () => queue.shift()!,
    });
    expect(code).toBe("cccccccc");
  });

  it("gives up after maxAttempts", async () => {
    await expect(
      allocateReferralCode(async () => false, { maxAttempts: 3, generate: () => "aaaaaaaa" }),
    ).rejects.toBeInstanceOf(ReferralCodeExhaustedError);
  });
});

describe("referralLink", () => {
  it("builds the signup link without double slashes", () => {
    expect(referralLink("https://trustsvan.com/", "abcd1234")).toBe(
      "https://trustsvan.com/signup?ref=abcd1234",
    );
  });
});
