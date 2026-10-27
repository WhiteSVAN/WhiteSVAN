import { PROGRAMME_RULES as R } from "./prop-firm";

export interface AcademyLesson {
  id: string;
  title: string;
  summary: string;
  reading: string[];
  checklist: string[];
  reviewPrompt: string;
  selfCheck: {
    question: string;
    choices: string[];
    correctChoice: number;
    rationale: string;
  };
}

/** Free Academy lessons, independent of account data or live market specifications. */
export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    id: "contract-identity",
    title: "Know the contract before the trade",
    summary: "Identify an index derivative from its full contract and the applicable specification.",
    reading: [
      "NIFTY, BANK NIFTY and SENSEX name underlying indices. The underlying name alone does not identify an options contract. Record the exchange, instrument type, expiry and contract identifier; an option also needs its strike and call or put type.",
      "Check the exchange contract specification and your broker's instrument file for the relevant trading date. Keep the source, publication or effective date, and a copy or reference with your notes. Lot sizes, expiry conventions and available contracts can change, so a remembered value is not a reliable calculation input.",
    ],
    checklist: [
      "Separate the underlying, the derivative contract and each execution.",
      "Confirm whether quantity is reported as lots or individual units.",
      "Record the applicable lot size, price convention and settlement terms from a dated source.",
    ],
    reviewPrompt:
      "Take one past trade. Write its complete contract identity and identify the dated source you would use to validate quantity and contract terms. Mark any missing fields as unknown.",
    selfCheck: {
      question: "Which input is suitable for checking the quantity of a historical options trade?",
      choices: [
        "The lot size remembered from the last time you traded the index.",
        "The contract specification effective for that contract and trading date, together with the broker's quantity convention.",
        "The same multiplier used for every options market.",
      ],
      correctChoice: 1,
      rationale:
        "A dated, contract-specific source lets you establish the applicable lot size and what the broker's quantity means. A current specification or a different market's multiplier may not describe the historical trade.",
    },
  },
  {
    id: "costs-and-notes",
    title: "Reconcile the result after costs",
    summary: "Read a contract note and distinguish a trading result from a cash movement.",
    reading: [
      "A price move is only part of the result. Start with the broker's contract note and ledger, then identify gross trading profit or loss, brokerage, exchange or clearing charges, applicable taxes and other charges. Use the amounts and rules relevant to that transaction and date; these sample lessons do not supply current rates.",
      "Check how the export defines realised P&L. It may already include some costs. Subtracting the same charge again makes the result wrong. Deposits, withdrawals and margin transfers also change cash but are not trading profit or loss. Where settlements or other adjustments appear, reconcile them using the broker's documented statement conventions.",
    ],
    checklist: [
      "Match executions, account and statement period before comparing totals.",
      "Note which charges each P&L figure already includes.",
      "Explain differences with the ledger instead of forcing the numbers to agree.",
    ],
    reviewPrompt:
      "Choose one statement period. Make a bridge from the broker's gross result to its reported net result, label every cost, and list cash movements separately. Record any unreconciled difference.",
    selfCheck: {
      question: "The broker export already deducts a particular charge from P&L. What should your reconciliation do?",
      choices: [
        "Deduct every charge again to be conservative.",
        "Add deposits to trading profit to match the cash balance.",
        "Record that charge as included and avoid deducting it a second time.",
      ],
      correctChoice: 2,
      rationale:
        "A reconciliation needs consistent definitions. Identify included costs so each charge affects the result once, and keep funding movements separate from trading performance.",
    },
  },
  {
    id: "assessment-and-pathway",
    title: "How the evaluation and funded account work",
    summary: "What you need to pass, what passing gets you and how payouts work.",
    reading: [
      `The evaluation is an account with fixed rules: a ${R.targetPercent}% profit target over at least ${R.minimumDays} trading days, a ${R.dailyLossPercent}% daily loss limit and a ${R.maximumLossPercent}% max drawdown that trails your highest end-of-day balance until it reaches your starting balance. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit. Every fill includes Indian trading costs, so plan your size after costs, not before.`,
      `Passing opens your funded account. It keeps the same loss limits, with no profit target. You keep ${R.contractorSharePercent}% of the profit: profit equal to your max drawdown stays in the account as a buffer, and you can request a payout whenever your profit is above it, up to the cap for your account size. KYC and your funded trader agreement come before the first payout, and every request is checked against the rules.`,
    ],
    checklist: [
      "Write down the profit target, daily loss limit and max drawdown for your account size.",
      "Size every trade so one bad day stays inside the daily loss limit.",
      "Read the payout rules before you start: split, cap, buffer and eligibility.",
    ],
    reviewPrompt:
      "Write your evaluation plan: your account size, your daily stop, the most you will risk on one trade, and what you will do after a losing day.",
    selfCheck: {
      question: "What do you get when you pass the evaluation?",
      choices: [
        "The account balance, paid to you as cash.",
        `A funded account with an ${R.contractorSharePercent}% profit split, paid out within the rules and caps.`,
        "A funded account with no loss limits.",
      ],
      correctChoice: 1,
      rationale:
        "The balance is never paid out as cash, and funded accounts keep the loss limits. Payouts follow the profit split, payout caps and rules in your funded trader agreement.",
    },
  },
];
