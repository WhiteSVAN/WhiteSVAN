"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { logout } from "./actions";

const ITEMS = [
  { href: "/upload", label: "Connect broker" },
  { href: "/reports", label: "My briefs" },
  { href: "/settings", label: "Settings" },
];

/**
 * Account dropdown for the app shell — keeps the top nav to a few primary tabs
 * and tucks the secondary destinations (broker connection, briefs, settings) plus sign-out
 * behind the user's name. Closes on outside click or Escape.
 */
export function AccountMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-700 bg-[#111713] px-3 py-1 text-zinc-300 transition hover:border-zinc-400 hover:text-white"
      >
        <span className="max-w-[10rem] truncate">{label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl shadow-black/40"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-zinc-800" />
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
