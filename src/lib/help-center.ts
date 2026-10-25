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

/** Three topics, in the order a trader needs them: evaluations, rules, then funded accounts and payouts. */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "evaluations",
    title: "Evaluations",
    summary: "Starting, account sizes and how to pass.",
    articles: [
      {
        id: "how-to-start",
        question: "How do I start an evaluation?",
        answer: `In three steps: create your account, choose your account size (${first.label} to ${last.label}) and check out. You don't need to pick a size to create your account: you choose it at checkout, on the same screen as paying. Your demo account, the evaluation, opens as soon as you check out.`,
      },
      {
        id: "buy-today",
        question: "When can I start?",
        answer: "Now. Create your account, choose a size and check out on one screen: your demo account opens straight away.",
      },
      {
        id: "who-can-join",
        question: "Who can join?",
        answer: "Traders resident in India. Before your first payout from a funded account, you complete KYC with your PAN, Aadhaar (through DigiLocker) and bank account.",
      },
      {
        id: "account-sizes",
        question: "Which account sizes can I choose?",
        answer: `${sizeList}. Fees run from ${formatInr(first.fee)} to ${formatInr(last.fee)}, one-time, GST included. No subscription and no activation fee.`,
      },
      {
        id: "how-to-pass",
        question: "How do I pass?",
        answer: `Hit the ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without hitting the daily loss limit or the max drawdown. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit; if it is, keep trading until it isn't.`,
      },
      {
        id: "rule-breach",
        question: "What happens if I break a rule?",
        answer: "Hitting the daily loss limit or the max drawdown ends the account. You get a breach report showing the trade and the rule, and you can appeal within 7 days. You can start a new evaluation any time.",
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
    title: "Rules",
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
        answer: "NIFTY and BANK NIFTY options on NSE, and SENSEX options on BSE. Intraday only: the market opens at 09:15 IST, you close by 15:20, and you can't open new positions in expiring contracts in the last hour of expiry day. Buy calls or puts and sell only to close them: no short options, spreads or hedges.",
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
      {
        id: "tips",
        question: "Do you give trading tips or calls?",
        answer: "No. WhiteSVAN and SVAN Academy teach the rules and risk management. No tips, calls or recommendations, and Academy case studies use market data at least 30 days old.",
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
        answer: "Your funded account opens as soon as you pass: the same size and loss limits, with no profit target. Your payout figures show on the Payouts page. Before your first payout, complete KYC and sign your funded trader agreement.",
      },
      {
        id: "contractor-pay",
        question: "How do payouts work?",
        answer: `You keep ${R.contractorSharePercent}% of the profit on your funded account. Request a payout twice a month, up to ${caps} per payout for ${first.label} to ${last.label} accounts. Profit equal to your max drawdown stays in the account as a buffer, and tax is deducted at source where it applies.`,
      },
      {
        id: "real-money",
        question: "Is the account balance real money?",
        answer: "No. Demo (evaluation) and funded accounts are simulated. The account size sets your limits and your payout cap; your payouts are real.",
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
