import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { ThemePicker } from "@/components/theme-toggle";
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
    <footer className="border-t border-[var(--border)] bg-[var(--card-deep)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_1.4fr]">
        <div>
          <Link href="/" className="text-xl">
            <SvanLogo />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">
            The prop firm for NIFTY, BANK NIFTY and SENSEX traders. Pass one evaluation, get funded
            and keep {PROGRAMME_RULES.contractorSharePercent}% of your profits.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-medium text-[var(--foreground)]">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
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
        <div className="space-y-2 border-t border-[var(--border)] pt-6 text-xs leading-5 text-[var(--muted)]">
          {DISCLAIMERS.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Copyright 2026 WhiteSVAN. All rights reserved. Past performance does not guarantee future results.</span>
          <ThemePicker />
        </div>
      </div>
    </footer>
  );
}
