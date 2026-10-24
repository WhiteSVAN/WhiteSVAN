"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { DEMO_CHECKOUT, DEMO_CREDIT } from "@/lib/checkout/demo";
import { formatInr } from "@/lib/prop-firm";

const LINKS = [
  ["/#accounts", "Pricing"],
  ["/how-it-works", "How it works"],
  ["/rules", "Rules"],
  ["/funded", "Payouts"],
  ["/academy", "Academy"],
  ["/help", "Help center"],
] as const;

/** Public Discord invite; the link is hidden until this is set. */
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL;

export function PropHeader() {
  const [open, setOpen] = useState(false);
  // Storefront pages stay static; the header asks for the session in the browser and swaps
  // "Log in" for "My accounts" when someone is signed in.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: unknown) => {
        if (live) setSignedIn(typeof session === "object" && session !== null && "user" in session);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const account = signedIn ? { href: "/dashboard", label: "My accounts" } : { href: "/login", label: "Log in" };
  return <>
    <div className="border-b border-[var(--border)] bg-[#172216] px-4 py-2.5 text-center text-[11px] text-[#c7d7bd]">
      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> {DEMO_CHECKOUT ? `Demo open: ${formatInr(DEMO_CREDIT)} of virtual credit to start an evaluation` : "Launching soon"}
      <span className="hidden sm:inline"><span className="mx-3 text-[#52644b]">/</span> NIFTY, BANK NIFTY &amp; SENSEX futures and options</span>
      <Link href={DEMO_CHECKOUT ? "/checkout" : "/signup"} className="ml-3 font-medium text-[var(--primary)] underline-offset-4 hover:underline">{DEMO_CHECKOUT ? "Try it free" : "Get early access"}</Link>
    </div>
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0b0f0d]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="WhiteSVAN home" className="text-[23px]"><SvanLogo /></Link>
        <nav className="ml-auto hidden items-center gap-7 text-xs text-[var(--muted)] lg:flex" aria-label="Main navigation">
          {LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:text-[var(--primary)]">{label}</Link>)}
          {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--primary)]">Discord</a>}
        </nav>
        <div className="ml-auto flex items-center gap-5 lg:ml-3">
          <Link href={account.href} className="hidden text-xs text-[#d4ddcf] sm:block">{account.label}</Link>
          <Link href="/checkout" className="prop-button prop-header-cta min-h-10 px-4 text-xs">Get funded <ArrowUpRight size={15} /></Link>
          <button type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="prop-mobile-nav" onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] lg:hidden">{open ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </div>
      {open && <nav id="prop-mobile-nav" aria-label="Mobile navigation" className="grid gap-1 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4 lg:hidden">
        {LINKS.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm hover:bg-[var(--card)]">{label}</Link>)}
        {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="rounded-md px-3 py-3 text-sm hover:bg-[var(--card)]">Discord</a>}
        <Link href={account.href} onClick={() => setOpen(false)} className="px-3 py-3 text-sm text-[var(--primary)]">{account.label}</Link>
      </nav>}
    </header>
  </>;
}
