import type { NextRequest } from "next/server";
import { tradingNow } from "@/lib/accounts/clock";
import { CheckoutError, fulfilRazorpayOrder } from "@/lib/checkout/orders";
import { capturedPayment, razorpayConfig, webhookSignatureValid } from "@/lib/checkout/razorpay";
import { sendReceipt } from "@/lib/checkout/receipt";
import { logger } from "@/lib/logger";

/**
 * Razorpay's webhook (add `<site>/api/razorpay/webhook` in the dashboard for `payment.captured`
 * and `order.paid`, with RAZORPAY_WEBHOOK_SECRET as its secret). It opens the account for a paid
 * order when the browser never got back, for example a closed tab after paying. Repeats and
 * out-of-order events are safe: an order opens one account.
 */
export async function POST(request: NextRequest) {
  const config = razorpayConfig();
  if (!config?.webhookSecret) return Response.json({ error: "not_configured" }, { status: 404 });
  const raw = await request.text();
  if (!webhookSignatureValid(config.webhookSecret, raw, request.headers.get("x-razorpay-signature") ?? "")) {
    logger.warn("razorpay.webhook_signature_mismatch", { event: request.headers.get("x-razorpay-event-id") });
    return Response.json({ error: "signature" }, { status: 400 });
  }
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "body" }, { status: 400 });
  }
  const payment = capturedPayment(event);
  if (!payment) return Response.json({ ok: true });
  try {
    const fulfilled = await fulfilRazorpayOrder({ ...payment, now: tradingNow() });
    if (!fulfilled) logger.warn("razorpay.webhook_no_open_order", { razorpayOrderId: payment.razorpayOrderId, paymentId: payment.paymentId });
    else if (fulfilled.opened) {
      logger.info("checkout.razorpay_paid", { userId: fulfilled.userId, orderId: fulfilled.orderId, accountId: fulfilled.accountId, via: "webhook" });
      await sendReceipt(fulfilled.email, fulfilled, { kind: "paid", amount: fulfilled.amount, paymentId: payment.paymentId });
    }
    return Response.json({ ok: true });
  } catch (error) {
    // A payment that doesn't match its order needs a person, not a retry.
    if (error instanceof CheckoutError) {
      logger.error("razorpay.webhook_refused", { razorpayOrderId: payment.razorpayOrderId, paymentId: payment.paymentId, error: error.message });
      return Response.json({ ok: false });
    }
    throw error;
  }
}
