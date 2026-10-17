/**
 * Kite login for the firm's own account. The day's access token lives only in an encrypted,
 * HTTP-only cookie in the browser that logged in: never in the database, never readable by page
 * scripts, and tied to the WhiteSVAN user who connected it. Server only (node:crypto).
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { clockSeconds, istInstant, toIst } from "@/lib/trading/time";

export const KITE_SESSION_COOKIE = "wsv_kite";
/** Short-lived login state, checked when Kite redirects back. */
export const KITE_STATE_COOKIE = "wsv_kite_state";

/** POST /session/token checksum: SHA-256 of api_key + request_token + api_secret, in hex. */
export const sessionChecksum = (apiKey: string, requestToken: string, apiSecret: string) =>
  createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");

export const newLoginState = () => randomBytes(16).toString("hex");

export function sameState(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/** Kite expires access tokens at 06:00 IST the morning after login (a regulatory rule). */
export function kiteTokenExpiry(loginAt: number): number {
  const { date, second } = toIst(loginAt);
  const sixAm = clockSeconds("06:00");
  const today = istInstant(date, sixAm);
  return second < sixAm ? today : today + 86_400_000;
}

export interface KiteSession {
  /** WhiteSVAN user who connected the account. */
  userId: string;
  /** Zerodha client ID and name. */
  kiteUserId: string;
  kiteUserName: string;
  accessToken: string;
  /** UTC epoch ms when Kite expires the token. */
  expiresAt: number;
}

const key = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "whitesvan-kite", "kite-session-v1", 32));

export function sealKiteSession(session: KiteSession, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ v: 1, ...session }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** The cookie's session if it decrypts, belongs to `userId` and has not expired; otherwise null. */
export function openKiteSession(value: string | undefined, secret: string, userId: string, now: number): KiteSession | null {
  if (!value) return null;
  try {
    const sealed = Buffer.from(value, "base64url");
    if (sealed.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), sealed.subarray(0, 12));
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));
    const json = Buffer.concat([decipher.update(sealed.subarray(12, sealed.length - 16)), decipher.final()]).toString("utf8");
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== "object" || payload === null) return null;
    const { v, userId: owner, kiteUserId, kiteUserName, accessToken, expiresAt } = payload as Record<string, unknown>;
    if (v !== 1 || owner !== userId || typeof kiteUserId !== "string" || typeof kiteUserName !== "string") return null;
    if (typeof accessToken !== "string" || !accessToken || typeof expiresAt !== "number" || expiresAt <= now) return null;
    return { userId: owner, kiteUserId, kiteUserName, accessToken, expiresAt };
  } catch {
    return null;
  }
}
