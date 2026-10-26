/**
 * How an order was settled, in the words the receipt and the platform's welcome use. Never says a
 * payment was taken unless Razorpay confirmed one; "demo" orders are from the virtual-credit days.
 */
import { formatPaise } from "@/lib/trading/money";

export interface SettledOrder {
  provider: string;
  /** Paise. */
  amount: number;
  providerPaymentId: string | null;
}

export function settlement(order: SettledOrder): { amount: string; payment: string; summary: string } {
  const rupees = formatPaise(order.amount, 0);
  const reference = order.providerPaymentId ? ` · ${order.providerPaymentId}` : "";
  switch (order.provider) {
    case "razorpay": return { amount: `${rupees} · GST included`, payment: `Razorpay${reference}`, summary: `Paid ${rupees} through Razorpay.` };
    case "razorpay-test": return { amount: `${rupees} · test mode, not charged`, payment: `Razorpay test mode${reference}`, summary: "Razorpay test mode: no money was charged." };
    case "test": return { amount: `${rupees} · not charged`, payment: "Test purchase", summary: "Test purchase: nothing was charged." };
    case "demo": return { amount: "None", payment: "Virtual credit, nobody charged", summary: "Opened with virtual credit: nobody was charged." };
    default: return { amount: rupees, payment: "No payment taken", summary: "No payment was taken." };
  }
}
