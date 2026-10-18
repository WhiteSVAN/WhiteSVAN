import type { NextRequest } from "next/server";
import { accountJson } from "@/lib/accounts/api";
import { tradingNow } from "@/lib/accounts/clock";
import { changeAccount } from "@/lib/accounts/store";
import { deskStep } from "@/lib/trading/desk";

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
