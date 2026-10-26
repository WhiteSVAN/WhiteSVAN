"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ThemePicker } from "@/components/theme-toggle";
import { logout } from "./actions";

const ITEMS = [
  { href: "/payouts", label: "Payouts" },
  { href: "/academy", label: "Academy" },
  { href: "/help", label: "Help center" },
  { href: "/settings", label: "Settings" },
];

/** The account dropdown: Payouts, Academy, Help, Settings, the theme and sign-out behind the user's name. Closes on outside click or Escape. */
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
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
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
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--card-raised)]"
            >
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-[var(--border)] px-3 pb-2 pt-3">
            <p className="mb-2 text-xs text-[var(--muted)]">Theme</p>
            <ThemePicker />
          </div>
          <div className="my-1 border-t border-[var(--border)]" />
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--card-raised)]"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
