"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

/** `exact`: an item that's current only on its own path, not under it (a section's overview). */
export function WorkspaceNav({ items, exact }: { items: readonly NavItem[]; exact?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace navigation" className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto text-xs">
      {items.map((item) => {
        const current = pathname === item.href || (item.href !== exact && pathname.startsWith(`${item.href}/`));
        return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center border-b-2 font-medium ${current ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
          {item.label}
        </Link>;
      })}
    </nav>
  );
}
