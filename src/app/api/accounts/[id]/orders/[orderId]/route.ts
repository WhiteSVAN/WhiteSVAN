import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountJson, orderQuotes } from "@/lib/accounts/api";
import { tradingNow } from "@/lib/accounts/clock";
import { changeAccount } from "@/lib/accounts/store";
import { applyModify } from "@/lib/accounts/ticks";
import { deskStep } from "@/lib/trading/desk";
import { quoteKey } from "@/lib/zerodha/kite";

const changesSchema = z
  .object({
    lots: z.number().int().min(1).max(1_000).optional(),
    limitPrice: z.number().int().positive().optional(),
    triggerPrice: z.number().int().positive().optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0);

/** Modify a working order: new lots, limit or trigger, against a fresh quote. The engine checks it like a new order. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id, orderId } = await params;
  const parsed = changesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "input", message: "Send new lots, a limit price or a trigger price." }, { status: 400 });
  return accountJson("modify", id, async ({ userId, account, config, accessToken }) => {
    const working = account.desk.state.orders.find((order) => order.id === orderId);
    const instrument = working && account.desk.instruments.find((item) => item.token === working.token);
    const quotes = instrument ? await orderQuotes(config, accessToken, [quoteKey(instrument)]) : [];
    const changed = await changeAccount(userId, id, (desk) => {
      const result = applyModify(desk, orderId, parsed.data, quotes, tradingNow());
      return { desk: result.desk, result: result.outputs };
    });
    return { outputs: changed?.result ?? [], desk: changed?.account.desk ?? account.desk };
  });
}

/** Cancel a working order. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id, orderId } = await params;
  return accountJson("cancel", id, async ({ userId, account }) => {
    const changed = await changeAccount(userId, id, (desk) => {
      const result = deskStep(desk, { kind: "cancel", at: tradingNow(), orderId }, new Map());
      return { desk: result.desk, result: result.outputs };
    });
    return { outputs: changed?.result ?? [], desk: changed?.account.desk ?? account.desk };
  });
}
