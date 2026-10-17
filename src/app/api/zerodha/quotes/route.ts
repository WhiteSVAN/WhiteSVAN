import type { NextRequest } from "next/server";
import { kiteJson } from "@/lib/zerodha/access";
import { fetchQuotes } from "@/lib/zerodha/client";
import { isQuoteKey } from "@/lib/zerodha/kite";

const MAX_KEYS = 8;

/** Quotes with five-level depth: `?i=NSE:NIFTY 50&i=NFO:<contract>`. One Kite call per request. */
export async function GET(request: NextRequest) {
  const keys = [...new Set(request.nextUrl.searchParams.getAll("i"))];
  if (keys.length === 0 || keys.length > MAX_KEYS || !keys.every(isQuoteKey)) {
    return Response.json({ error: "input", message: `Pass 1 to ${MAX_KEYS} quote keys as exchange:symbol.` }, { status: 400 });
  }
  return kiteJson("quotes", async ({ config, accessToken }) => ({ quotes: await fetchQuotes(config, accessToken, keys, Date.now()) }));
}
