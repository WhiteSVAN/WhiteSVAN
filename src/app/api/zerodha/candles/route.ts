import type { NextRequest } from "next/server";
import { isInterval } from "@/lib/market-data/candles";
import { kiteJson } from "@/lib/zerodha/access";
import { fetchCandles } from "@/lib/zerodha/client";

/** Candles for one instrument: `?token=<instrument token>&interval=<Kite interval>[&oi=1]`. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = Number(params.get("token"));
  const interval = params.get("interval") ?? "";
  if (!Number.isSafeInteger(token) || token <= 0 || !isInterval(interval)) {
    return Response.json({ error: "input", message: "Pass an instrument token and a Kite interval." }, { status: 400 });
  }
  return kiteJson("candles", async ({ config, accessToken }) => ({
    candles: await fetchCandles(config, accessToken, token, interval, params.get("oi") === "1", Date.now()),
  }));
}
