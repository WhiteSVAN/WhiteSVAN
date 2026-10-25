import type { NextRequest } from "next/server";
import { screenQuotes } from "@/lib/accounts/ticks";
import { kiteJson } from "@/lib/zerodha/access";
import { fetchQuotes } from "@/lib/zerodha/client";
import { isQuoteKey } from "@/lib/zerodha/kite";

const MAX_KEYS = 40;

/**
 * Quotes for the charts without an account: `?i=NFO:<charted contract>&i=NSE:NIFTY 50&i=...`, the
 * first with five-level depth and the rest with the best bid and offer. Screens polling together
 * share one Kite call.
 */
export async function GET(request: NextRequest) {
  const keys = [...new Set(request.nextUrl.searchParams.getAll("i"))];
  if (keys.length === 0 || keys.length > MAX_KEYS || !keys.every(isQuoteKey)) {
    return Response.json({ error: "input", message: `Pass 1 to ${MAX_KEYS} quote keys as exchange:symbol.` }, { status: 400 });
  }
  return kiteJson("quotes", async ({ config, accessToken }) => ({ quotes: screenQuotes(await fetchQuotes(config, accessToken, keys), new Set(keys.slice(0, 1))) }));
}
