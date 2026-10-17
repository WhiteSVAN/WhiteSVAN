import { describe, expect, it } from "vitest";
import { ist } from "@/lib/trading/time";
import { kiteConfig, isKiteOwner } from "./config";
import { kiteTokenExpiry, openKiteSession, sameState, sealKiteSession, sessionChecksum, type KiteSession } from "./session";

const SECRET = "test-auth-secret-0123456789abcdef";
const session: KiteSession = { userId: "user_1", kiteUserId: "AB1234", kiteUserName: "Owner", accessToken: "access-token", expiresAt: ist("2026-10-17 06:00") };

describe("Kite session", () => {
  it("signs the token request with SHA-256 of key, request token and secret", () => {
    // printf 'kitekey123reqtok456secret789' | sha256sum
    expect(sessionChecksum("kitekey123", "reqtok456", "secret789")).toBe("cacaaa99fc116fdfa4daa3b4139dbb384ce8ae3c122e380509a2b671996bac00");
  });

  it("expires at 06:00 IST after login", () => {
    expect(kiteTokenExpiry(ist("2026-10-16 10:00"))).toBe(ist("2026-10-17 06:00"));
    expect(kiteTokenExpiry(ist("2026-10-17 02:00"))).toBe(ist("2026-10-17 06:00"));
    expect(kiteTokenExpiry(ist("2026-10-17 06:00"))).toBe(ist("2026-10-18 06:00"));
  });

  it("round-trips the encrypted cookie for its owner until it expires", () => {
    const sealed = sealKiteSession(session, SECRET);
    expect(sealed).not.toContain("access-token");
    expect(openKiteSession(sealed, SECRET, "user_1", ist("2026-10-16 15:00"))).toEqual(session);
    expect(openKiteSession(sealed, SECRET, "user_2", ist("2026-10-16 15:00"))).toBeNull();
    expect(openKiteSession(sealed, SECRET, "user_1", ist("2026-10-17 06:00"))).toBeNull();
    expect(sealKiteSession(session, SECRET)).not.toBe(sealed);
  });

  it("rejects a tampered cookie, another secret or junk", () => {
    const sealed = sealKiteSession(session, SECRET);
    const flipped = sealed.slice(0, 20) + (sealed[20] === "A" ? "B" : "A") + sealed.slice(21);
    const now = ist("2026-10-16 15:00");
    expect(openKiteSession(flipped, SECRET, "user_1", now)).toBeNull();
    expect(openKiteSession(sealed, `${SECRET}x`, "user_1", now)).toBeNull();
    expect(openKiteSession("not-a-cookie", SECRET, "user_1", now)).toBeNull();
    expect(openKiteSession(undefined, SECRET, "user_1", now)).toBeNull();
  });

  it("compares login state exactly", () => {
    expect(sameState("abc123", "abc123")).toBe(true);
    expect(sameState("abc124", "abc123")).toBe(false);
    expect(sameState("abc", "abc123")).toBe(false);
    expect(sameState(null, "abc123")).toBe(false);
    expect(sameState("", "")).toBe(false);
  });
});

describe("Kite configuration", () => {
  const env = { KITE_API_KEY: "key", KITE_API_SECRET: "secret", AUTH_SECRET: SECRET, KITE_OWNER_EMAILS: " Founder@WhiteSVAN.in, ops@whitesvan.in ", NODE_ENV: "production" };

  it("needs the key, the secret, the auth secret and at least one owner", () => {
    expect(kiteConfig(env)).toMatchObject({ apiKey: "key", apiSecret: "secret", ownerEmails: ["founder@whitesvan.in", "ops@whitesvan.in"], apiRoot: "https://api.kite.trade" });
    for (const missing of ["KITE_API_KEY", "KITE_API_SECRET", "AUTH_SECRET", "KITE_OWNER_EMAILS"]) {
      expect(kiteConfig({ ...env, [missing]: "" })).toBeNull();
    }
  });

  it("lets only listed sign-ins use the account, ignoring case", () => {
    const config = kiteConfig(env);
    expect(isKiteOwner(config, "FOUNDER@whitesvan.in")).toBe(true);
    expect(isKiteOwner(config, "trader@example.com")).toBe(false);
    expect(isKiteOwner(config, null)).toBe(false);
    expect(isKiteOwner(null, "founder@whitesvan.in")).toBe(false);
  });

  it("points at a stand-in Kite server only outside production", () => {
    const local = { ...env, KITE_API_ROOT: "http://127.0.0.1:4555/", KITE_LOGIN_URL: "http://127.0.0.1:4555/connect/login" };
    expect(kiteConfig(local)?.apiRoot).toBe("https://api.kite.trade");
    expect(kiteConfig({ ...local, NODE_ENV: "development" })).toMatchObject({ apiRoot: "http://127.0.0.1:4555", loginUrl: "http://127.0.0.1:4555/connect/login" });
  });
});
