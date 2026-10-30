/**
 * JSON routes over one of the signed-in trader's evaluation accounts (server only). Prices come
 * from the firm's shared Kite login, so every account holder trades while it is connected; without
 * it the routes answer 401 with {@link PRICES_OFFLINE}.
 */
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { fetchContracts, fetchQuotes } from "@/lib/zerodha/client";
import { gfdlConfig } from "@/lib/gfdl/config";
import { GFDL_CONTEXT, kiteFailure, NO_STORE } from "@/lib/zerodha/access";
import { kiteConfig, type KiteConfig } from "@/lib/zerodha/config";
import { PRICES_OFFLINE, sharedKiteSession } from "@/lib/zerodha/connection";
import { contractInstrument, KiteError, type MarketQuote } from "@/lib/zerodha/kite";
import type { Instrument } from "@/lib/trading/instruments";
import { AccountBusyError, findAccount, type StoredAccount } from "./store";

export interface AccountContext {
  userId: string;
  account: StoredAccount;
  config: KiteConfig;
  accessToken: string;
}

export async function accountJson(name: string, accountId: string, run: (context: AccountContext) => Promise<unknown>): Promise<Response> {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "signed_out", message: "Sign in to trade." }, { status: 401, headers: NO_STORE });
  const account = await findAccount(userId, accountId);
  if (!account) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  const config = kiteConfig();
  // With Global Datafeeds on, no Kite login is needed: the calls in client.ts don't use it.
  const session = gfdlConfig() ? GFDL_CONTEXT : config ? await sharedKiteSession(config.sessionSecret) : null;
  if (!session) return Response.json({ error: "session", message: PRICES_OFFLINE }, { status: 401, headers: NO_STORE });
  const context = { config: config ?? GFDL_CONTEXT.config, accessToken: session.accessToken };
  try {
    return Response.json(await run({ userId, account, ...context }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AccountBusyError) return Response.json({ error: "busy", message: error.message }, { status: 409, headers: NO_STORE });
    return kiteFailure(`accounts.${name}`, error, context);
  }
}

/** Today's contract for a token, as an engine instrument; null when it isn't one of ours. */
export async function instrumentForToken(config: KiteConfig, accessToken: string, token: number, now: number): Promise<Instrument | null> {
  for (const exchange of ["NFO", "BFO"] as const) {
    const contract = (await fetchContracts(config, accessToken, exchange, now)).find((item) => item.token === token);
    if (contract) return contractInstrument(contract);
  }
  return null;
}

/** Quotes for an order, through the shared quote calls; one retry if Kite or the queue turns it away. */
export async function orderQuotes(config: KiteConfig, accessToken: string, keys: string[]): Promise<MarketQuote[]> {
  try {
    return await fetchQuotes(config, accessToken, keys);
  } catch (error) {
    if (!(error instanceof KiteError) || error.status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    return fetchQuotes(config, accessToken, keys);
  }
}

export const newOrderId = (now: number) => `O${now.toString(36)}${randomBytes(3).toString("hex")}`.toUpperCase();
