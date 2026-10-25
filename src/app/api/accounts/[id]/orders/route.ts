import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountJson, instrumentForToken, newOrderId, orderQuotes } from "@/lib/accounts/api";
import { tradingNow } from "@/lib/accounts/clock";
import { changeAccount } from "@/lib/accounts/store";
import { listAccounts } from "@/lib/accounts/store";
import { applyOrder, expectedPrice, orderPolicyProblem } from "@/lib/accounts/ticks";
import { exitsProblem } from "@/lib/trading/desk";
import { KiteError, quoteKey } from "@/lib/zerodha/kite";

const orderSchema = z.object({
  token: z.number().int().positive(),
  side: z.enum(["BUY", "SELL"]),
  lots: z.number().int().min(1).max(1_000),
  type: z.enum(["MARKET", "LIMIT", "SL", "SL-M"]),
  limitPrice: z.number().int().positive().optional(),
  triggerPrice: z.number().int().positive().optional(),
  /** A buy's stop-loss trigger and target, placed as sell orders once it fills. */
  stopLoss: z.number().int().positive().optional(),
  target: z.number().int().positive().optional(),
});

/**
 * Place an order on the account against a fresh quote, within the trading policy, with a buy's
 * stop-loss and target if it has them. The engine validates and fills it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "input", message: "Send a contract, side, lots and order type." }, { status: 400 });
  return accountJson("order", id, async ({ userId, account, config, accessToken }) => {
    const now = Date.now();
    const instrument = account.desk.instruments.find((item) => item.token === parsed.data.token) ?? (await instrumentForToken(config, accessToken, parsed.data.token, now));
    if (!instrument) throw new KiteError("That contract isn't in today's instrument list.", 400, "InputException");
    const others = (await listAccounts(userId)).filter((item) => item.id !== account.id && item.status === "ACTIVE").map((item) => item.desk);
    const problem = orderPolicyProblem(account.desk, instrument, parsed.data.side, parsed.data.lots, others);
    if (problem) throw new KiteError(problem, 400, "InputException");
    const quotes = await orderQuotes(config, accessToken, [quoteKey(instrument)]);
    const { stopLoss, target, ...request } = parsed.data;
    const exits = { stop: stopLoss, target };
    const exitProblem = exitsProblem(exits, request.side, expectedPrice(request, quotes.find((quote) => quote.token === instrument.token)?.lastPrice), instrument.tickSize);
    if (exitProblem) throw new KiteError(exitProblem, 400, "InputException");
    const order = { ...request, id: newOrderId(now) };
    const changed = await changeAccount(userId, id, (desk) => {
      const result = applyOrder(desk, instrument, order, quotes, tradingNow(), exits);
      return { desk: result.desk, result: result.outputs };
    });
    return { outputs: changed?.result ?? [], desk: changed?.account.desk ?? account.desk };
  });
}
