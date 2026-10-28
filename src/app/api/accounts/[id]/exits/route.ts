import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountJson, newOrderId, orderQuotes } from "@/lib/accounts/api";
import { tradingNow } from "@/lib/accounts/clock";
import { changeAccount } from "@/lib/accounts/store";
import { applyExits } from "@/lib/accounts/ticks";
import { positionExitsProblem } from "@/lib/trading/desk";
import { KiteError, quoteKey } from "@/lib/zerodha/kite";

const exitsSchema = z
  .object({
    token: z.number().int().positive(),
    /** A price in paise sets or moves the exit, null removes it; one left out stays. */
    stopLoss: z.number().int().positive().nullable().optional(),
    target: z.number().int().positive().nullable().optional(),
  })
  .refine((body) => body.stopLoss !== undefined || body.target !== undefined);

/**
 * Set, move or remove the stop-loss and target of an option the trader holds, after buying it,
 * checked against a fresh quote. Each exit sells the whole position; when one fills, the other is
 * cancelled.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = exitsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "input", message: "Send an option and a stop-loss or target." }, { status: 400 });
  const { token, stopLoss, target } = parsed.data;
  const changes = { stop: stopLoss, target };
  return accountJson("exits", id, async ({ userId, account, config, accessToken }) => {
    const instrument = account.desk.instruments.find((item) => item.token === token);
    if (!instrument) throw new KiteError("You don't hold this option.", 400, "InputException");
    // Removing an exit needs no price; setting or moving one is checked against a fresh one.
    const quotes = stopLoss || target ? await orderQuotes(config, accessToken, [quoteKey(instrument)]) : [];
    const lastPrice = quotes.find((quote) => quote.token === token)?.lastPrice;
    const changed = await changeAccount(userId, id, (desk) => {
      const problem = positionExitsProblem(desk, token, changes, lastPrice);
      if (problem) throw new KiteError(problem, 400, "InputException");
      const result = applyExits(desk, token, changes, quotes, tradingNow(), newOrderId(Date.now()));
      return { desk: result.desk, result: result.outputs };
    });
    return { outputs: changed?.result ?? [], desk: changed?.account.desk ?? account.desk };
  });
}
