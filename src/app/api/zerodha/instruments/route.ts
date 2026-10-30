import type { NextRequest } from "next/server";
import { kiteJson } from "@/lib/zerodha/access";
import { fetchOptionChain, indexToken } from "@/lib/zerodha/client";
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
    const { label, indexKey } = UNDERLYINGS[underlying];
    // Only the expiry on screen loads (the expiry list is small); others load when picked.
    const [token, loaded] = await Promise.all([indexToken(config, accessToken, underlying), fetchOptionChain(config, accessToken, underlying, asked, now)]);
    const { chain } = contractsFor(loaded.contracts, underlying, toIst(now).date);
    return { underlying, index: { key: indexKey, token, label }, expiries: loaded.expiries, expiry: loaded.expiry, chain: loaded.expiry ? chain(loaded.expiry) : [] };
  });
}
