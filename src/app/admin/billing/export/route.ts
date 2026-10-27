import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { PROVIDER_LABELS, moneyReceived, orderStateLabel, ordersForExport } from "@/lib/admin/customers";
import { csvRupees as inr, csvText as text } from "@/lib/admin/csv";
import { orderFilters } from "@/lib/admin/filters";
import { accountNumber, INDIAN_STATES } from "@/lib/checkout/billing";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { findAccountPlan } from "@/lib/prop-firm";
import { toIst } from "@/lib/trading/time";

const istTime = (at: Date | null) => {
  if (!at) return "";
  const moment = toIst(at.getTime());
  const second = moment.second;
  return `${moment.date} ${String(Math.floor(second / 3600)).padStart(2, "0")}:${String(Math.floor((second % 3600) / 60)).padStart(2, "0")}:${String(second % 60).padStart(2, "0")}`;
};

const HEADER = ["placed_ist", "paid_ist", "order_id", "customer_email", "customer_name", "size", "amount_inr", "currency", "paid_with", "state", "money_received", "razorpay_order_id", "razorpay_payment_id", "billing_name", "billing_email", "billing_phone", "gst_state", "terms_accepted_ist", "account"];

/** The orders the billing page's filters match, as CSV for accounting, oldest first (admins only; up to 50,000 rows). */
export async function GET(request: NextRequest) {
  const session = await auth();
  const admin = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, isAdmin: true } }) : null;
  if (!admin?.isAdmin) return new Response("Not found", { status: 404 });
  const filters = orderFilters(Object.fromEntries(request.nextUrl.searchParams), INDIAN_STATES);
  const orders = await ordersForExport(filters);
  logger.info("admin.export", { adminId: admin.id, export: "billing", rows: orders.length, filters });
  const lines = [HEADER.join(",")];
  for (const order of orders) {
    lines.push([
      text(istTime(order.createdAt)), text(istTime(order.paidAt)), text(order.id), text(order.user.email), text(order.user.name),
      text(findAccountPlan(order.planId)?.label ?? order.planId), inr(order.amount), text(order.currency),
      text(PROVIDER_LABELS[order.provider] ?? order.provider), text(orderStateLabel(order.provider, order.status)), moneyReceived(order) ? "yes" : "no",
      text(order.providerOrderId?.startsWith("order_") ? order.providerOrderId : ""), text(order.providerPaymentId),
      text(order.billingName), text(order.billingEmail), text(order.billingPhone), text(order.billingState), text(istTime(order.acceptedTermsAt)),
      text(order.account ? accountNumber(order.account.id, order.account.planId) : ""),
    ].join(","));
  }
  const name = `whitesvan-orders-${toIst(Date.now()).date}.csv`;
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
