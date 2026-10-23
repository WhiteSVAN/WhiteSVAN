"use client";

/** Follow and private watchlist controls, backed by authenticated server actions. */
import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, UserPlus, UserCheck } from "lucide-react";
import { toggleFollow, toggleWatchlist, type ToggleResult } from "@/app/network-actions";

const FAILURE_MESSAGES = {
  signin: "Your session expired. Sign in to save this change.",
  unavailable: "This record is no longer available. Refresh and try again.",
  self: "You cannot follow your own record.",
  rate: "Too many changes. Please wait a minute and try again.",
} as const;

export function FollowButtons({
  profileId, following, watching, followerCount, signedIn, isOwner = false, size = "md",
}: {
  profileId: string; following: boolean; watching: boolean; followerCount: number;
  signedIn: boolean; isOwner?: boolean; size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [returnTo, setReturnTo] = useState("/explore");
  const errorId = useId();
  const [state, setState] = useOptimistic(
    { following, watching, followerCount },
    (cur, patch: Partial<{ following: boolean; watching: boolean; followerCount: number }>) => ({ ...cur, ...patch }),
  );
  const pad = size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs";
  const base = `inline-flex min-h-9 items-center gap-1.5 rounded-md border transition disabled:opacity-60 ${pad}`;
  const on = "border-[#57733a] bg-[#1a2418] text-[#dff5c4]";
  const off = "border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white";

  function change(kind: "follow" | "watchlist") {
    setError(null);
    setNeedsLogin(false);
    start(async () => {
      const original = { following, watching, followerCount };
      setState(kind === "follow" ? {
        following: !state.following,
        followerCount: Math.max(0, state.followerCount + (state.following ? -1 : 1)),
      } : { watching: !state.watching });
      try {
        const result: ToggleResult = await (kind === "follow" ? toggleFollow(profileId) : toggleWatchlist(profileId));
        if (!result.ok) {
          setState(original);
          setError(FAILURE_MESSAGES[result.error]);
          if (result.error === "signin") {
            setNeedsLogin(true);
            setReturnTo(`${window.location.pathname}${window.location.search}`);
          }
        }
      } catch {
        setState(original);
        setError("We couldn't save this change. Please try again.");
      }
    });
  }

  if (!signedIn) {
    return <div className="flex items-center gap-2"><Link href="/login?next=%2Fexplore" className={`${base} ${off}`}><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Sign in to follow</Link><span className="font-mono text-[10px] text-zinc-500">{followerCount} follower{followerCount === 1 ? "" : "s"}</span></div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
        {!isOwner && <button type="button" disabled={pending} aria-pressed={state.following} aria-describedby={error ? errorId : undefined} onClick={() => change("follow")} className={`${base} ${state.following ? on : off}`}>
          {state.following ? <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}{state.following ? "Following" : "Follow"}
        </button>}
        <button type="button" disabled={pending} aria-pressed={state.watching} aria-describedby={error ? errorId : undefined} title="Private — only you can see your watchlist" onClick={() => change("watchlist")} className={`${base} ${state.watching ? on : off}`}>
          <Bookmark className="h-3.5 w-3.5" fill={state.watching ? "currentColor" : "none"} aria-hidden="true" />{state.watching ? "On watchlist" : "Watchlist"}
        </button>
        <span className="font-mono text-[10px] text-zinc-500" aria-live="polite">{pending ? "Saving…" : `${state.followerCount} follower${state.followerCount === 1 ? "" : "s"}`}</span>
      </div>
      {error && <p id={errorId} role="alert" className="mt-2 text-xs leading-5 text-[var(--danger)]">{error}{needsLogin && <> <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="text-[var(--primary)] underline">Sign in</Link></>}</p>}
    </div>
  );
}
