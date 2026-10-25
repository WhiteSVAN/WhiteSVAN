import type { NextRequest } from "next/server";
import { kiteJson } from "@/lib/zerodha/access";
import { fetchContracts, indexToken } from "@/lib/zerodha/client";
import { contractsFor, isUnderlying, UNDERLYINGS, type InstrumentList } from "@/lib/zerodha/kite";
import { toIst } from "@/lib/trading/time";

/** An underlying's option expiries and one expiry's strikes, and its index for the money line: `?underlying=NIFTY[&expiry=YYYY-MM-DD]`. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const underlying = params.get("underlying") ?? "";
  const asked = params.get("expiry");
  if (!isUnderlying(underlying) || (asked !== null && !/^\d{4}-\d{2}-\d{2}$/.test(asked))) {
    return Response.json({ error: "input", message: "Pass NIFTY, BANKNIFTY or SENSEX, and an expiry as YYYY-MM-DD." }, { status: 400 });
  }
  return kiteJson("instruments", async ({ config, accessToken }): Promise<InstrumentList> => {
    const now = Date.now();
    const { label, indexKey, exchange } = UNDERLYINGS[underlying];
    const [token, contracts] = await Promise.all([indexToken(config, accessToken, underlying), fetchContracts(config, accessToken, exchange, now)]);
    const { expiries, chain } = contractsFor(contracts, underlying, toIst(now).date);
    const expiry = asked && expiries.includes(asked) ? asked : expiries[0] ?? null;
    return { underlying, index: { key: indexKey, token, label }, expiries, expiry, chain: expiry ? chain(expiry) : [] };
  });
}
