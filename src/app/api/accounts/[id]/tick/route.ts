import type { NextRequest } from "next/server";
import { accountJson } from "@/lib/accounts/api";
import { tradingNow } from "@/lib/accounts/clock";
import { changeAccount } from "@/lib/accounts/store";
import { applyTick, tickKeys } from "@/lib/accounts/ticks";
import { fetchQuotes } from "@/lib/zerodha/client";

/**
 * The platform's poll: quotes for the account's contracts and the screen's (`{ keys }`), shared
 * with the other screens polling that second, fed into the account (fills, marks, square-off,
 * day close). Returns both.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const keys = typeof body === "object" && body !== null && "keys" in body && Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === "string").slice(0, 16) : [];
  return accountJson("tick", id, async ({ userId, account, config, accessToken }) => {
    const wanted = tickKeys(account.desk, keys);
    const quotes = wanted.length > 0 ? await fetchQuotes(config, accessToken, wanted) : [];
    const changed = await changeAccount(userId, id, (desk) => ({ desk: applyTick(desk, quotes, tradingNow()), result: null }));
    return { quotes, desk: changed?.account.desk ?? account.desk };
  });
}
