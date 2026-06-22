import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";

const FOOTER_GROUPS = [
  {
    title: "Platform",
    links: [
      { href: "/explore", label: "Verified traders" },
      { href: "/signup", label: "Get verified" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Verification",
    links: [
      { href: "/signup", label: "Broker connections" },
      { href: "/explore", label: "Proof-backed profiles" },
      { href: "/signup", label: "Research briefs" },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/signup", label: "Private rooms" },
      { href: "/explore", label: "Operator directory" },
      { href: "/signup", label: "Join beta" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-12 lg:grid-cols-[1.1fr_1.4fr]">
        <div>
          <Link href="/" className="text-base font-semibold tracking-[0.18em] text-zinc-100">
            <SvanLogo />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
            A verification and diligence network for market operators, brokers, prop firms, and
            research teams that need source-backed trading records.
          </p>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            TrustSVAN does not manage money, execute trades, copy trades, provide investment
            advice, or guarantee performance.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 transition hover:text-zinc-200"
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

      <div className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright 2026 TrustSVAN. All rights reserved.</span>
          <span>Past performance is not indicative of future results.</span>
        </div>
      </div>
    </footer>
  );
}
