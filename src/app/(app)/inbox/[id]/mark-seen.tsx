"use client";

import { startTransition, useEffect, useRef } from "react";
import { markNotificationsSeen } from "../actions";

/** Clears this thread's unread notifications once the thread is on screen. */
export function MarkThreadSeen({ href, before }: { href: string; before: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    startTransition(async () => {
      try {
        await markNotificationsSeen({ href, before });
      } catch {
        done.current = false;
      }
    });
  }, [href, before]);
  return null;
}
