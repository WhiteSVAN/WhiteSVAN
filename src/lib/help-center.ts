/** Public help-centre content. Rule figures come from the rulebook in prop-firm.ts. */
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
    summary: "What WhiteSVAN is and how to start.",
    articles: [
      {
        id: "what-is-whitesvan",
        question: "What is WhiteSVAN?",
        answer: `WhiteSVAN is a prop trading firm for Indian index futures and options. Pass our evaluation, get a funded account and earn an ${R.contractorSharePercent}% profit split trading NIFTY, BANK NIFTY and SENSEX.`,
      },
      {
        id: "buy-today",
        question: "When can I start?",
        answer: "We're launching soon. Create your account now to get early access, and we'll email you when evaluations open.",
      },
      {
        id: "who-can-join",
        question: "Who can join?",
        answer: "Traders resident in India. After you pass, you complete KYC with your PAN, Aadhaar (through DigiLocker) and bank account before your funded account starts.",
      },
      {
        id: "experience",
        question: "Do I need trading experience?",
        answer: "No minimum. The evaluation checks one thing: can you hit the target while staying inside the loss limits. SVAN Academy walks through every rule with worked examples.",
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
        question: "Which account sizes can I choose?",
        answer: `${sizeList}. Fees run from ${formatInr(first.fee)} to ${formatInr(last.fee)}, one-time, GST included. No subscription and no activation fee.`,
      },
      {
        id: "how-to-pass",
        question: "How do I pass?",
        answer: `Hit the ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without breaking the daily loss limit or the max drawdown. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit; if it is, keep trading until it isn't.`,
      },
      {
        id: "real-money",
        question: "Is the account balance real money?",
        answer: "No. Evaluation and funded accounts are simulated. The account size sets your limits and your payout cap; your payouts are real.",
      },
      {
        id: "rule-breach",
        question: "What happens if I break a rule?",
        answer: "Breaking the daily loss limit or the max drawdown ends the account. You get a breach report showing the trade and the rule, and you can appeal within 7 days. You can start a new evaluation any time.",
      },
      {
        id: "how-many-accounts",
        question: "How many accounts can I have?",
        answer: `Up to ${R.maximumAccounts} evaluation or funded accounts at once. Hedging across accounts, copying another trader and sharing logins are not allowed.`,
      },
    ],
  },
  {
    id: "rules",
    title: "Rules and risk",
    summary: "Drawdown, daily loss, products, hours and costs.",
    articles: [
      {
        id: "maximum-loss",
        question: "How does the max drawdown work?",
        answer: `It's ${R.maximumLossPercent}% of your starting balance. It trails your highest end-of-day balance until it reaches your starting balance, then locks. On a ${first.label} account your floor starts at ${formatInr(first.balance - firstLimits.maximumLoss)} and locks at ${formatInr(first.balance)}.`,
      },
      {
        id: "daily-loss",
        question: "What's the daily loss limit?",
        answer: `${R.dailyLossPercent}% of your starting balance (${formatInr(firstLimits.dailyLoss)} on a ${first.label} account), counting open and closed P&L for the day.`,
      },
      {
        id: "markets-and-hours",
        question: "What can I trade, and when?",
        answer: "NIFTY and BANK NIFTY futures and options on NSE, and SENSEX futures and options on BSE. Intraday only: the market opens at 09:15 IST, you close by 15:20, and you can't open new positions in expiring contracts in the last hour of expiry day. Sell options only inside defined-risk spreads.",
      },
      {
        id: "trading-costs",
        question: "Are trading costs included?",
        answer: "Yes. Every fill includes brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST, with realistic fills at the bid or ask.",
      },
      {
        id: "lots",
        question: "Why are positions limited in lots?",
        answer: "Index contracts trade in exchange lots, and the exchanges change lot sizes from time to time. Your limit is a number of lots, checked against the current lot sizes.",
      },
    ],
  },
  {
    id: "payouts",
    title: "Funded accounts and payouts",
    summary: "What happens after you pass.",
    articles: [
      {
        id: "after-passing",
        question: "What happens after I pass?",
        answer: "Complete KYC and sign your funded trader agreement. You'll get your funded account within 5 working days of completing KYC.",
      },
      {
        id: "contractor-pay",
        question: "How do payouts work?",
        answer: `You keep ${R.contractorSharePercent}% of the profit on your funded account. Request a payout twice a month, up to ${caps} per payout for ${first.label} to ${last.label} accounts. Profit equal to your max drawdown stays in the account as a buffer, and tax is deducted at source where it applies.`,
      },
      {
        id: "live-capital",
        question: "Is my funded account live money?",
        answer: "No. Funded accounts are simulated, like the evaluation; your payouts are real. WhiteSVAN may copy some funded traders with its own capital, which doesn't change your account or your payouts.",
      },
      {
        id: "deposits",
        question: "Do I have to deposit money?",
        answer: "No. You pay the one-time evaluation fee and nothing else. You never deposit trading capital.",
      },
      {
        id: "payout-certainty",
        question: "Can a payout request be refused?",
        answer: "Yes, if the rules weren't followed: for example a breach, hedging across accounts or a request above your cap. Every request is checked against the rules before it's paid.",
      },
    ],
  },
  {
    id: "academy",
    title: "SVAN Academy",
    summary: "Free lessons and rule practice.",
    articles: [
      {
        id: "what-is-academy",
        question: "What is SVAN Academy?",
        answer: "Free lessons on contracts, costs, position sizing and the evaluation rules, plus a drawdown exercise you can try before you trade.",
      },
      {
        id: "tips",
        question: "Does the Academy give trading tips or calls?",
        answer: "No. The Academy teaches the rules and risk management. No tips, calls or recommendations, and case studies use market data at least 30 days old.",
      },
    ],
  },
  {
    id: "account",
    title: "Your account and tools",
    summary: "Log in, dashboard and the trading journal.",
    articles: [
      {
        id: "need-account",
        question: "Do I need an account to look around?",
        answer: "No. Pricing, rules, the Academy and this help center are public. Create a free account to get early access and use the trader dashboard.",
      },
      {
        id: "journal",
        question: "Where is my trading journal?",
        answer: "Log in and open Tools. Your journal, imports, performance reports and profile are all there, separate from your evaluation accounts.",
      },
      {
        id: "support",
        question: "How do I contact support?",
        answer: "Support opens with evaluations. Until then, join the early-access list and we'll email you when evaluations open.",
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
