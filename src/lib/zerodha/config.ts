/**
 * Zerodha charts are switched on by KITE_API_KEY, KITE_API_SECRET and KITE_OWNER_EMAILS (the
 * WhiteSVAN sign-ins that may connect and disconnect the firm's Zerodha account; every signed-in
 * user reads prices through that login). Kite itself only lets the app's own Zerodha client ID
 * log in. Server only.
 */
import { KITE_API_ROOT, KITE_LOGIN_URL } from "./kite";

export interface KiteConfig {
  apiKey: string;
  apiSecret: string;
  /** Encrypts the access-token cookie (the Auth.js secret). */
  sessionSecret: string;
  ownerEmails: readonly string[];
  apiRoot: string;
  loginUrl: string;
}

type Env = Partial<Record<string, string>>;

export function kiteConfig(env: Env = process.env): KiteConfig | null {
  const apiKey = env.KITE_API_KEY?.trim();
  const apiSecret = env.KITE_API_SECRET?.trim();
  const sessionSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  const ownerEmails = (env.KITE_OWNER_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!apiKey || !apiSecret || !sessionSecret || ownerEmails.length === 0) return null;
  // KITE_API_ROOT and KITE_LOGIN_URL point local development at a stand-in Kite server.
  // Production always talks to Zerodha.
  const local = env.NODE_ENV !== "production";
  return {
    apiKey,
    apiSecret,
    sessionSecret,
    ownerEmails,
    apiRoot: (local && env.KITE_API_ROOT?.replace(/\/+$/, "")) || KITE_API_ROOT,
    loginUrl: (local && env.KITE_LOGIN_URL) || KITE_LOGIN_URL,
  };
}

export const isKiteOwner = (config: KiteConfig | null, email: string | null | undefined): config is KiteConfig =>
  Boolean(config && email && config.ownerEmails.includes(email.trim().toLowerCase()));
