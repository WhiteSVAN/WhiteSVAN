/** The order confirmation email, sent once per order, best effort: a failed email never fails the order. */
import { sendOrderConfirmation, type OrderPayment } from "@/lib/email";
import { logger } from "@/lib/logger";
import { findAccountPlan } from "@/lib/prop-firm";

export async function sendReceipt(to: string, order: { orderId: string; planId: string; accountId: string }, payment: OrderPayment): Promise<void> {
  const planLabel = findAccountPlan(order.planId)?.label ?? order.planId;
  await sendOrderConfirmation(to, { planLabel, planId: order.planId, accountId: order.accountId, payment }).catch((error: unknown) => {
    logger.warn("checkout.confirmation_email_failed", { orderId: order.orderId, error: error instanceof Error ? error.message : String(error) });
  });
}
