"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  ["/how-it-works", "How it works"],
  ["/evaluations", "Pricing"],
  ["/rules", "Rules"],
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
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="WhiteSVAN home" className="text-[22px]"><SvanLogo /></Link>
        <nav className="ml-auto hidden items-center gap-7 text-sm text-[var(--muted)] md:flex" aria-label="Main navigation">
          {LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:text-[var(--foreground)]">{label}</Link>)}
          {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">Discord</a>}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3 md:ml-3">
          <Link href={account.href} className="hidden px-2 text-sm text-[var(--foreground)] sm:block">{account.label}</Link>
          <ThemeToggle className="prop-header-theme" />
          <Link href="/checkout" className="prop-button prop-header-cta min-h-10 px-4 text-sm">Get funded <ArrowUpRight size={15} /></Link>
          <button type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="prop-mobile-nav" onClick={() => setOpen(!open)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] md:hidden">{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </div>
      {open && <nav id="prop-mobile-nav" aria-label="Mobile navigation" className="grid gap-1 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4 md:hidden">
        {LINKS.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm hover:bg-[var(--card-raised)]">{label}</Link>)}
        {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-3 text-sm hover:bg-[var(--card-raised)]">Discord</a>}
        <Link href={account.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm hover:bg-[var(--card-raised)]">{account.label}</Link>
        <Link href="/checkout" onClick={() => setOpen(false)} className="prop-button mt-2">Get funded <ArrowUpRight size={15} /></Link>
      </nav>}
    </header>
  </>;
}
