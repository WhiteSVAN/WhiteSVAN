/**
 * Funded-account payout quote (TRD PAY-2): what a trader can request now, and what blocks it, in
 * paise. Approval, payment through the payouts API and TDS records are separate steps; tax rates
 * are not hard-coded here.
 */
import { assertPaise, divCeil, percentOfFloor, type Paise } from "./money";
import type { AccountState } from "./engine";
import type { RuleSet } from "./rules";

type PayoutRules = Pick<RuleSet, "maxLoss" | "profitSplitPercent" | "payoutCap">;

export interface PayoutAmounts {
  /** Profit equal to the max drawdown stays in the account. */
  buffer: Paise;
  withdrawableProfit: Paise;
  /** The trader's split of the withdrawable profit, before the cap. */
  traderShare: Paise;
  /** Paid to the trader (before any tax deducted at source). */
  payout: Paise;
  /** Profit taken off the account balance for this payout: the trader's share and the firm's. */
  debit: Paise;
}

/** The payout arithmetic: the split of the profit above the buffer, up to the cap and any request. */
export function payoutAmounts(rules: PayoutRules, profit: Paise, requested?: Paise): PayoutAmounts {
  assertPaise(profit, "Profit");
  if (requested !== undefined && (!Number.isSafeInteger(requested) || requested <= 0)) {
    throw new RangeError("A payout request must be a positive number of paise.");
  }
  const withdrawableProfit = Math.max(0, profit - rules.maxLoss);
  const traderShare = percentOfFloor(withdrawableProfit, rules.profitSplitPercent);
  const payout = Math.min(traderShare, rules.payoutCap, requested ?? Number.MAX_SAFE_INTEGER);
  const debit = payout > 0 ? divCeil(payout * 100, rules.profitSplitPercent) : 0;
  return { buffer: rules.maxLoss, withdrawableProfit, traderShare, payout, debit };
}

/** Funded-account profit at which a single payout reaches the cap. */
export function profitForFullPayout(rules: PayoutRules): Paise {
  return rules.maxLoss + divCeil(rules.payoutCap * 100, rules.profitSplitPercent);
}

export interface PayoutChecks {
  kycVerified: boolean;
  agreementSigned: boolean;
  bankVerified: boolean;
  /** An open risk or fraud review on the account. */
  onHold: boolean;
}

export type PayoutBlock =
  | "NOT_FUNDED"
  | "ACCOUNT_CLOSED"
  | "OPEN_POSITIONS"
  | "KYC"
  | "AGREEMENT"
  | "BANK"
  | "ON_HOLD"
  | "NO_PROFIT_ABOVE_BUFFER";

export interface PayoutQuote extends PayoutAmounts {
  eligible: boolean;
  blocks: PayoutBlock[];
  /** Balance above the starting balance. */
  profit: Paise;
}

/** Eligible profit can be requested on demand, subject to the account checks and per-request cap. */
export function quotePayout(state: AccountState, checks: PayoutChecks, requested?: Paise): PayoutQuote {
  const profit = state.balance - state.rules.startingBalance;
  const amounts = payoutAmounts(state.rules, profit, requested);

  const blocks: PayoutBlock[] = [];
  if (state.phase !== "FUNDED") blocks.push("NOT_FUNDED");
  if (state.status !== "ACTIVE") blocks.push("ACCOUNT_CLOSED");
  if (state.positions.length > 0 || state.orders.length > 0) blocks.push("OPEN_POSITIONS");
  if (!checks.kycVerified) blocks.push("KYC");
  if (!checks.agreementSigned) blocks.push("AGREEMENT");
  if (!checks.bankVerified) blocks.push("BANK");
  if (checks.onHold) blocks.push("ON_HOLD");
  if (amounts.payout <= 0) blocks.push("NO_PROFIT_ABOVE_BUFFER");

  return { eligible: blocks.length === 0, blocks, profit, ...amounts };
}
