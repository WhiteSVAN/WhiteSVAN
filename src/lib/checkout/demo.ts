/**
 * Demo mode, until a payment gateway is live: every user gets virtual credit and buys evaluations
 * with it at the normal prices, so the whole purchase flow can be tried. Nobody is charged, and the
 * accounts it opens are demo accounts (EvaluationAccount.demo): they never lead to a funded account
 * or a payout. Switching demo mode off is a code change, because the storefront copy follows this
 * flag. Safe for the browser: no environment or database.
 */
import { formatInr } from "@/lib/prop-firm";

export const DEMO_CHECKOUT = true;

/** Virtual credit each user starts with, in rupees. */
export const DEMO_CREDIT = 50_000;

/** Credit left, in paise, after `spent` paise of demo purchases. */
export const demoCreditLeft = (spent: number) => Math.max(0, DEMO_CREDIT * 100 - spent);

/** The storefront's answer to "when can I start?" while demo mode is on. */
export const DEMO_START_ANSWER = `Now, in demo mode. Every new account gets ${formatInr(DEMO_CREDIT)} of virtual credit to start evaluations at the normal prices. Nobody is charged, and demo accounts don't lead to funded accounts or payouts. Payments open at launch.`;
