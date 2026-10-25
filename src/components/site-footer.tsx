import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { PROGRAMME_RULES } from "@/lib/prop-firm";

/** Public Discord invite; the link is hidden until this is set. */
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

/** Public pages only. */
const FOOTER_GROUPS = [
  {
    title: "Programme",
    links: [
      { href: "/evaluations", label: "Evaluation accounts" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/rules", label: "Trading rules" },
      { href: "/funded", label: "Funded accounts & payouts" },
      { href: "/academy", label: "SVAN Academy" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help center" },
      ...(DISCORD_URL ? [{ href: DISCORD_URL, label: "Discord community" }] : []),
      { href: "/signup", label: "Create an account" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

const DISCLAIMERS = [
  "Demo and funded accounts are simulated. Account sizes are virtual balances that set risk limits; they are not deposits, loans or capital given to the trader. Evaluation fees are service fees.",
  "Nothing on this site is investment advice, a recommendation or a trading signal. WhiteSVAN does not manage client money and does not promise any income, payout or return.",
  "Trading options carries a substantial risk of loss. Simulated results have limitations and do not represent actual trading.",
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
            The prop firm for NIFTY, BANK NIFTY and SENSEX traders. Pass one evaluation, get funded
            and keep {PROGRAMME_RULES.contractorSharePercent}% of your profits.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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
