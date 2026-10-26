/**
 * Checkout details for an evaluation purchase. Shared by the checkout form and its Server Action.
 * Only a paid checkout asks for them: the mobile number goes to Razorpay and the state is the GST
 * place of supply on the invoice (fees are GST-inclusive). A free start or a staff test purchase
 * takes no payment, so it asks for nothing. Pressing the checkout button accepts the rules.
 */
import { z } from "zod";
import type { EvaluationPlan } from "@/lib/prop-firm";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export const billingSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(?:\+?91)?[6-9]\d{9}$/, { error: "Enter a 10-digit Indian mobile number." }))
    .transform((value) => `+91${value.slice(-10)}`),
  state: z.enum(INDIAN_STATES, { error: "Choose your state." }),
});

/** What an order records: the account's name, and for a paid order the mobile and state. */
export interface Billing {
  name: string | null;
  phone: string | null;
  state: string | null;
}

/** The amount charged for a plan, in paise, GST included. */
export const planAmount = (plan: EvaluationPlan) => plan.fee * 100;

/** A short, readable account number for screens and support: WSV-1L-4F2A9C. */
export const accountNumber = (id: string, planId: string) => `WSV-${planId.replace(/-/g, "").toUpperCase()}-${id.slice(-6).toUpperCase()}`;

/** Where a completed checkout lands: the new account's trading platform, which welcomes it. */
export const openedPath = (accountId: string, orderId: string) => `/trade/${accountId}?${new URLSearchParams({ opened: orderId })}`;
