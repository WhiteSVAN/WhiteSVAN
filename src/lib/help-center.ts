/** Public help-centre content. Rule figures come from the draft rulebook in prop-firm.ts. */
import { EVALUATION_PLANS, PROGRAMME_RULES, formatInr, planLimits } from "./prop-firm";

export type HelpArticle = { id: string; question: string; answer: string };
export type HelpTopic = { id: string; title: string; summary: string; articles: HelpArticle[] };

const R = PROGRAMME_RULES;
const first = EVALUATION_PLANS[0];
const last = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];
const firstLimits = planLimits(first);
const sizes = EVALUATION_PLANS.map((p) => p.label);
const sizeList = `${sizes.slice(0, -1).join(", ")} and ${sizes[sizes.length - 1]}`;
const caps = EVALUATION_PLANS.map((p) => formatInr(p.payoutCap)).join(" / ");

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "What WhiteSVAN is and what you can do today.",
    articles: [
      {
        id: "what-is-whitesvan",
        question: "What is WhiteSVAN?",
        answer: "WhiteSVAN is building an India-first prop trading programme for NIFTY, BANK NIFTY and SENSEX futures and options. You learn with SVAN Academy, take a simulated evaluation and, after passing and review, can join the simulated contractor desk.",
      },
      {
        id: "buy-today",
        question: "Can I buy an evaluation today?",
        answer: "Not yet. WhiteSVAN is in launch preview: account sizes, prices and rules are drafts, and checkout is not open. Join the launch list to hear when evaluations open.",
      },
      {
        id: "who-can-join",
        question: "Who can take part?",
        answer: "The programme is planned for Indian residents. After you pass, you complete KYC (PAN, Aadhaar through DigiLocker and bank-account verification) before a contractor agreement is signed.",
      },
      {
        id: "experience",
        question: "Do I need trading experience?",
        answer: "The draft rules set no minimum experience. The evaluation tests a disciplined process against clear limits, and the Academy explains each rule with worked examples before you start.",
      },
    ],
  },
  {
    id: "evaluations",
    title: "Evaluations",
    summary: "Account sizes, fees and how to pass.",
    articles: [
      {
        id: "account-sizes",
        question: "Which account sizes are available?",
        answer: `Four simulated balances: ${sizeList}. The proposed one-time fees run from ${formatInr(first.fee)} to ${formatInr(last.fee)}, GST included, with no activation fee and no monthly subscription.`,
      },
      {
        id: "how-to-pass",
        question: "How do I pass?",
        answer: `Reach a ${R.targetPercent}% net profit target over at least ${R.minimumDays} trading days without breaching a loss limit. When you pass, your best day must be no more than ${R.consistencyPercent}% of total profit; falling short of that delays the pass rather than ending the attempt.`,
      },
      {
        id: "real-money",
        question: "Is the account balance real money?",
        answer: "No. Every evaluation and contractor account is simulated. The balance is a risk budget that sets your limits; it is not a deposit, a loan or capital paid to you.",
      },
      {
        id: "rule-breach",
        question: "What happens if I break a rule?",
        answer: "A daily-loss or maximum-loss breach ends the attempt, and you receive a breach report naming the trade and the rule. You can appeal within 7 days; a second reviewer decides from the evidence.",
      },
      {
        id: "how-many-accounts",
        question: "How many accounts can I hold?",
        answer: `Up to ${R.maximumAccounts} active evaluation or Level 1 accounts per person. Hedging across accounts, copying another trader and sharing logins are not allowed.`,
      },
    ],
  },
  {
    id: "rules",
    title: "Rules and risk",
    summary: "Loss limits, markets, sessions and costs.",
    articles: [
      {
        id: "maximum-loss",
        question: "How does the maximum loss work?",
        answer: `The maximum loss is ${R.maximumLossPercent}% of the starting balance. Its threshold trails your highest end-of-day balance and locks at the starting balance: on a ${first.label} account it starts at ${formatInr(first.balance - firstLimits.maximumLoss)} and stops rising at ${formatInr(first.balance)}.`,
      },
      {
        id: "daily-loss",
        question: "What is the daily loss limit?",
        answer: `${R.dailyLossPercent}% of the starting balance (${formatInr(firstLimits.dailyLoss)} on a ${first.label} account), measured on realised and unrealised P&L against the day's opening balance.`,
      },
      {
        id: "markets-and-hours",
        question: "Which markets and hours can I trade?",
        answer: "NIFTY and BANK NIFTY futures and options on NSE, and SENSEX futures and options on BSE, on listed expiries. Trading runs 09:15–15:30 IST and is intraday only: positions close at 15:20, and no new positions in expiring contracts are allowed in the final 60 minutes. Short options are allowed only inside defined-risk spreads.",
      },
      {
        id: "trading-costs",
        question: "Are trading costs included?",
        answer: "Yes. Every simulated fill includes brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST, and fills at the bid or ask with slippage, so simulated results track what a real account would show.",
      },
      {
        id: "lots",
        question: "Why are position limits set in lots?",
        answer: "Index contracts trade in exchange-set lots, and the exchanges revise lot sizes from time to time. Limits are set in lots and checked against the current contract master, never a fixed number of units.",
      },
    ],
  },
  {
    id: "payouts",
    title: "Sim desk and payouts",
    summary: "What happens after you pass.",
    articles: [
      {
        id: "after-passing",
        question: "What happens after I pass?",
        answer: "You complete KYC and sign a separate contractor agreement. Under the draft terms, an offer follows within 5 working days of completed KYC. Your contractor account stays simulated.",
      },
      {
        id: "contractor-pay",
        question: "How are contractors paid?",
        answer: `Under the draft terms you receive ${R.contractorSharePercent}% of eligible simulated net profit, reviewed twice a month. Each payout is capped by account size (${caps} for ${first.label} to ${last.label}), and profit up to the maximum-loss amount stays in the account as a buffer. Tax is deducted at source where it applies.`,
      },
      {
        id: "live-capital",
        question: "Will I trade live capital?",
        answer: "No. Contractor accounts stay simulated permanently. WhiteSVAN may separately copy selected contractors' trades with its own money; that does not change your account or your pay, and no trader logs in to the firm's broker account.",
      },
      {
        id: "deposits",
        question: "Do I need to deposit money?",
        answer: "No. Course and evaluation fees are service fees. Traders never pay deposits or contribute trading capital.",
      },
      {
        id: "payout-certainty",
        question: "Is a payout certain once I pass?",
        answer: "No. Payouts depend on eligible simulated profit, the buffer, per-cycle caps, rule compliance and review. Nothing on WhiteSVAN promises income or returns.",
      },
    ],
  },
  {
    id: "academy",
    title: "SVAN Academy",
    summary: "Lessons and practice before you trade.",
    articles: [
      {
        id: "what-is-academy",
        question: "What is SVAN Academy?",
        answer: "Practical lessons on contracts, costs, risk and the evaluation rules. The preview has free sample lessons and a synthetic rule exercise you can try now.",
      },
      {
        id: "tips",
        question: "Does the Academy give trading tips or calls?",
        answer: "No. The Academy is education only: no tips, calls or recommendations. Case studies use market data at least 30 days old.",
      },
    ],
  },
  {
    id: "account",
    title: "Your account and tools",
    summary: "Sign-in, workspace and the trading journal.",
    articles: [
      {
        id: "need-account",
        question: "Do I need an account to explore?",
        answer: "No. Accounts, rules and the Academy preview are public. A free account opens the trader workspace and journal; it does not buy or start an evaluation.",
      },
      {
        id: "journal",
        question: "Where is my trading journal?",
        answer: "In your workspace under Tools: the journal, data imports, performance briefs and your published profile are all still there. Journal records are your own imported history and are separate from evaluation accounts.",
      },
      {
        id: "support",
        question: "How do I contact support?",
        answer: "Support opens with paid evaluations. Until then, join the launch list and we'll email you when evaluations open.",
      },
    ],
  },
];

/** Topics whose articles contain every word of the query (case-insensitive), keeping topic order. */
export function searchHelp(topics: readonly HelpTopic[], query: string): HelpTopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...topics];
  return topics
    .map((topic) => ({
      ...topic,
      articles: topic.articles.filter((article) => {
        const text = `${topic.title} ${article.question} ${article.answer}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((topic) => topic.articles.length > 0);
}
