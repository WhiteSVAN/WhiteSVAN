import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";

/** Public pages only — app routes (feed, inbox, communities) need an account. */
const FOOTER_GROUPS = [
  {
    title: "Traders",
    links: [
      { href: "/signup", label: "Build your trader record" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Clients",
    links: [
      { href: "/explore", label: "Discover traders" },
      { href: "/signup?as=client", label: "Join as a client" },
    ],
  },
  {
    title: "Directory",
    links: [{ href: "/explore", label: "Published traders" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-[#090d0b]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_1.4fr]">
        <div>
          <Link href="/" className="text-xl font-semibold text-zinc-100">
            <SvanLogo />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
            Source-linked trading records for traders, and a place for clients, firms, and
            allocators to discover and review them — with the source, coverage, and risk in view.
          </p>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            TrustSVAN does not manage money, execute trades, copy trades, provide investment
            advice, or guarantee performance.
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

      <div className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Copyright 2026 TrustSVAN. All rights reserved.</span>
          <span>Past performance does not guarantee future results.</span>
        </div>
      </div>
    </footer>
  );
}
