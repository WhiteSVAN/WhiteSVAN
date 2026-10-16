import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";

/** Public pages only — app routes (journal, feed, inbox) need an account. */
const FOOTER_GROUPS = [
  {
    title: "Programme",
    links: [
      { href: "/evaluations", label: "Evaluation accounts" },
      { href: "/rules", label: "Trading rules" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/academy", label: "SVAN Academy" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help center" },
      { href: "/signup", label: "Create an account" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Trader tools",
    links: [
      { href: "/login", label: "Trading journal" },
      { href: "/explore", label: "Published traders" },
    ],
  },
];

const DISCLAIMERS = [
  "WhiteSVAN is in launch preview. Evaluations, contractor payouts and checkout are not open, and the prices and rules shown are drafts until final terms are published.",
  "All evaluation and contractor accounts are simulated. An account size is a virtual balance that sets risk limits; it is not a deposit, a loan or capital given to the trader. Course and evaluation fees are service fees.",
  "Nothing on this site is investment advice, a recommendation or a trading signal. WhiteSVAN does not manage client money and does not promise any income, payout or return.",
  "Trading futures and options carries a substantial risk of loss. Simulated results have limitations and do not represent actual trading.",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[#090d0b]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_1.4fr]">
        <div>
          <Link href="/" className="text-xl font-semibold text-zinc-100">
            <SvanLogo />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
            An India-first prop trading programme for NIFTY, BANK NIFTY and SENSEX futures and
            options: learn with SVAN Academy, prove your process in a simulated evaluation, and
            work towards the simulated contractor desk.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-xs text-zinc-400 transition hover:text-zinc-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-8">
        <div className="space-y-2 border-t border-[var(--border)] pt-6 text-[11px] leading-5 text-zinc-500">
          {DISCLAIMERS.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Copyright 2026 WhiteSVAN. All rights reserved.</span>
          <span>Past performance does not guarantee future results.</span>
        </div>
      </div>
    </footer>
  );
}
