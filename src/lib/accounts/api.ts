/**
 * JSON routes over one of the signed-in trader's evaluation accounts (server only). Prices come
 * from the firm's own Kite session, so until a licensed exchange feed is connected only the
 * sign-ins in KITE_OWNER_EMAILS can trade; everyone else gets `no_data`.
 */
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { fetchContracts, fetchQuotes } from "@/lib/zerodha/client";
import { currentKiteOwner, currentKiteSession, kiteFailure, NO_STORE } from "@/lib/zerodha/access";
import type { KiteConfig } from "@/lib/zerodha/config";
import { contractInstrument, KiteError, type MarketQuote } from "@/lib/zerodha/kite";
import type { Instrument } from "@/lib/trading/instruments";
import { AccountBusyError, findAccount, type StoredAccount } from "./store";

export const NO_DATA_MESSAGE = "Live market data for evaluation accounts isn't connected yet.";

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
  const owner = await currentKiteOwner();
  if (!owner) return Response.json({ error: "no_data", message: NO_DATA_MESSAGE }, { status: 403, headers: NO_STORE });
  const session = await currentKiteSession(owner);
  if (!session) return Response.json({ error: "session", message: "Connect Zerodha to load prices." }, { status: 401, headers: NO_STORE });
  try {
    return Response.json(await run({ userId, account, config: owner.config, accessToken: session.accessToken }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AccountBusyError) return Response.json({ error: "busy", message: error.message }, { status: 409, headers: NO_STORE });
    return kiteFailure(`accounts.${name}`, error);
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

/** Quotes for an order. Kite allows one quote call a second, which a platform poll may have just used. */
export async function orderQuotes(config: KiteConfig, accessToken: string, keys: string[]): Promise<MarketQuote[]> {
  try {
    return await fetchQuotes(config, accessToken, keys, Date.now());
  } catch (error) {
    if (!(error instanceof KiteError) || error.status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    return fetchQuotes(config, accessToken, keys, Date.now());
  }
}

export const newOrderId = (now: number) => `O${now.toString(36)}${randomBytes(3).toString("hex")}`.toUpperCase();
