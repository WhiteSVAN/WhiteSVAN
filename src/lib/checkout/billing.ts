/**
 * Checkout details for an evaluation purchase. Shared by the checkout form and its Server Action.
 * The state is the GST place of supply on the invoice; fees are GST-inclusive.
 */
import { z } from "zod";
import { PROGRAMME_RULES, type EvaluationPlan } from "@/lib/prop-firm";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export const MAX_ACTIVE_ACCOUNTS = PROGRAMME_RULES.maximumAccounts;

export const billingSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter your full name." }).max(100, { error: "Use at most 100 characters." }),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(?:\+?91)?[6-9]\d{9}$/, { error: "Enter a 10-digit Indian mobile number." }))
    .transform((value) => `+91${value.slice(-10)}`),
  state: z.enum(INDIAN_STATES, { error: "Choose your state." }),
  terms: z.literal("on", { error: "Accept the rules and terms to continue." }),
});

export type Billing = z.infer<typeof billingSchema>;

/** The amount charged for a plan, in paise, GST included. */
export const planAmount = (plan: EvaluationPlan) => plan.fee * 100;

/** A short, readable account number for screens and support: WSV-1L-4F2A9C. */
export const accountNumber = (id: string, planId: string) => `WSV-${planId.replace(/-/g, "").toUpperCase()}-${id.slice(-6).toUpperCase()}`;
