import { describe, expect, it } from "vitest";
import { checkoutAttemptKey, isCheckoutAttemptId } from "./attempt";

const key = "3e48b07d-0dca-4dd1-8b4f-22013d642b84";

describe("checkout attempt keys", () => {
  it("accepts generated UUIDs and rejects missing or malformed input", () => {
    expect(isCheckoutAttemptId(key)).toBe(true);
    expect(isCheckoutAttemptId(key.toUpperCase())).toBe(true);
    for (const value of [null, undefined, "", "replay", `${key}suffix`, "x".repeat(10_000), 12, {}]) expect(isCheckoutAttemptId(value)).toBe(false);
  });
  it("scopes keys by owner and provider and canonicalizes UUID case", () => {
    expect(checkoutAttemptKey("owner", "free", key)).toBe(checkoutAttemptKey("owner", "free", key.toUpperCase()));
    expect(checkoutAttemptKey("other", "free", key)).not.toBe(checkoutAttemptKey("owner", "free", key));
    expect(checkoutAttemptKey("owner", "test", key)).not.toBe(checkoutAttemptKey("owner", "free", key));
    expect(() => checkoutAttemptKey("owner", "free", "bad")).toThrow("Invalid checkout attempt.");
  });
});
