import type { Metadata } from "next";
import { PropLanding } from "@/components/prop-firm/landing";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R } from "@/lib/prop-firm";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  title: "WhiteSVAN | Get funded trading NIFTY, BANK NIFTY and SENSEX",
  description: `Pass one evaluation, get funded and keep ${R.contractorSharePercent}% of your profits. ${FIRST.label}–${LAST.label} accounts for NIFTY, BANK NIFTY and SENSEX options, one-time fee from ${formatInr(FIRST.fee)}.`,
};

export default function Home() {
  return <PropLanding />;
}
