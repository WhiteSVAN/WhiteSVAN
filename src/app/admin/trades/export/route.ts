import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { fillsForExport } from "@/lib/admin/book";
import { csvRupees as inr, csvText as textCell } from "@/lib/admin/csv";
import { fillFilters } from "@/lib/admin/filters";
import { accountNumber } from "@/lib/checkout/billing";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toIst } from "@/lib/trading/time";

const istTime = (at: Date) => {
  const moment = toIst(at.getTime());
  const second = moment.second;
  return `${moment.date} ${String(Math.floor(second / 3600)).padStart(2, "0")}:${String(Math.floor((second % 3600) / 60)).padStart(2, "0")}:${String(second % 60).padStart(2, "0")}`;
};

const HEADER = ["time_ist", "trade_date", "trader_email", "trader_name", "account", "phase", "contract", "side", "units", "price_inr", "reason", "order_id", "fill_id", "realised_inr", "charges_inr", "brokerage_inr", "stt_inr", "exchange_inr", "sebi_inr", "stamp_inr", "gst_inr", "balance_after_inr"];

/** The fills the trades page's filters match, as CSV, oldest first (admins only; up to 50,000 rows). */
export async function GET(request: NextRequest) {
  const session = await auth();
  const admin = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, isAdmin: true } }) : null;
  if (!admin?.isAdmin) return new Response("Not found", { status: 404 });
  const filters = fillFilters(Object.fromEntries(request.nextUrl.searchParams));
  const fills = await fillsForExport(filters);
  logger.info("admin.export", { adminId: admin.id, rows: fills.length, filters });
  const lines = [HEADER.join(",")];
  for (const fill of fills) {
    const charges = (fill.charges ?? {}) as Record<string, number>;
    const part = (key: string) => inr(typeof charges[key] === "number" ? charges[key] : 0);
    lines.push([
      textCell(istTime(fill.at)), textCell(toIst(fill.at.getTime()).date), textCell(fill.user.email), textCell(fill.user.name),
      textCell(accountNumber(fill.accountId, fill.account.planId)), textCell(fill.account.phase), textCell(fill.tradingSymbol), textCell(fill.side),
      String(fill.quantity), inr(fill.price), textCell(fill.reason), textCell(fill.orderId), textCell(fill.fillId),
      inr(fill.realised), inr(fill.chargesTotal), part("brokerage"), part("stt"), part("transaction"), part("sebi"), part("stamp"), part("gst"), inr(fill.balanceAfter),
    ].join(","));
  }
  const name = `whitesvan-fills-${toIst(Date.now()).date}.csv`;
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
