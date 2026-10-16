"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type NavItem = { href: string; label: string };

export function WorkspaceNav({ items, tools, unread }: { items: readonly NavItem[]; tools: readonly NavItem[]; unread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const secondary = [...tools, { href: "/inbox", label: "Inbox" }];
  const toolIsCurrent = secondary.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
    <nav aria-label="Workspace navigation" className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto pb-1 text-xs">
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 font-medium ${current ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          {item.label}
        </Link>;
      })}
    </nav>
    <div className="relative shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="workspace-tools" className={`inline-flex min-h-10 items-center gap-1.5 text-xs font-medium ${toolIsCurrent ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
        Tools <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" aria-label={`${unread} unread inbox items`} />}
      </button>
      {open && <nav id="workspace-tools" aria-label="Trading tools" className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-2 shadow-2xl shadow-black/40">
        {secondary.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={pathname === item.href ? "page" : undefined} className="flex min-h-10 items-center justify-between rounded-md px-3 text-xs text-[var(--muted)] transition hover:bg-[var(--card-raised)] hover:text-[var(--foreground)] aria-[current=page]:text-[var(--primary)]">
          {item.label}
          {item.href === "/inbox" && unread > 0 && <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--primary-foreground)]">{unread > 99 ? "99+" : unread}</span>}
        </Link>)}
      </nav>}
    </div>
    </div>
  );
}
