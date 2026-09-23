"use client";

/**
 * Activity (in-app notifications) list. Marks what was rendered as read once
 * it is actually on screen (not on prefetch), then refreshes so the nav badge
 * updates — while keeping the "new" markers for this visit.
 */
import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { markNotificationsSeen } from "./actions";

export interface ActivityItem {
  id: string;
  title: string;
  href: string | null;
  unread: boolean;
  when: string;
  whenIso: string;
  whenTitle: string;
}

export function ActivityList({ items, renderedAt }: { items: ActivityItem[]; renderedAt: string }) {
  const [fresh] = useState(() => new Set(items.filter((i) => i.unread).map((i) => i.id)));
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || fresh.size === 0) return;
    marked.current = true;
    startTransition(async () => {
      try {
        await markNotificationsSeen({ before: renderedAt });
      } catch {
        marked.current = false;
      }
    });
  }, [fresh, renderedAt]);

  return (
    <ul className="divide-y divide-zinc-800">
      {items.map((item) => {
        const isNew = item.unread || fresh.has(item.id);
        const body = (
          <span className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isNew ? "bg-[#baf277]" : "bg-transparent"}`}
            />
            <span className="min-w-0 flex-1">
              <span className={`block break-words text-sm ${isNew ? "text-zinc-100" : "text-zinc-300"}`}>
                {isNew && <span className="sr-only">New: </span>}
                {item.title}
              </span>
              <time dateTime={item.whenIso} title={item.whenTitle} className="font-mono text-[10px] text-zinc-500">
                {item.when}
              </time>
            </span>
          </span>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="block rounded-md px-2 py-3 transition hover:bg-zinc-800">
                {body}
              </Link>
            ) : (
              <div className="px-2 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
