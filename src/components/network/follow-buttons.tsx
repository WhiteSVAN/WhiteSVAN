"use client";

/**
 * Follow (public count) + Watchlist (private) toggles for a trader profile.
 * Signed-out viewers are sent to sign in instead.
 */
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Bookmark, UserPlus, UserCheck } from "lucide-react";
import { toggleFollow, toggleWatchlist } from "@/app/network-actions";

export function FollowButtons({
  profileId,
  following,
  watching,
  followerCount,
  signedIn,
  isOwner = false,
  size = "md",
}: {
  profileId: string;
  following: boolean;
  watching: boolean;
  followerCount: number;
  signedIn: boolean;
  isOwner?: boolean;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useOptimistic(
    { following, watching, followerCount },
    (cur, patch: Partial<{ following: boolean; watching: boolean; followerCount: number }>) => ({ ...cur, ...patch }),
  );
  const pad = size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs";
  const base = `inline-flex items-center gap-1.5 rounded-md border transition disabled:opacity-60 ${pad}`;
  const on = "border-[#57733a] bg-[#1a2418] text-[#dff5c4]";
  const off = "border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white";

  if (!signedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={`${base} ${off}`}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Sign in to follow
        </Link>
        <span className="font-mono text-[10px] text-zinc-500">{followerCount} following</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isOwner && (
        <button
          type="button"
          disabled={pending}
          aria-pressed={state.following}
          onClick={() =>
            start(async () => {
              setState({
                following: !state.following,
                followerCount: state.followerCount + (state.following ? -1 : 1),
              });
              await toggleFollow(profileId);
            })
          }
          className={`${base} ${state.following ? on : off}`}
        >
          {state.following ? <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
          {state.following ? "Following" : "Follow"}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        aria-pressed={state.watching}
        title="Private — only you can see your watchlist"
        onClick={() =>
          start(async () => {
            setState({ watching: !state.watching });
            await toggleWatchlist(profileId);
          })
        }
        className={`${base} ${state.watching ? on : off}`}
      >
        <Bookmark className="h-3.5 w-3.5" fill={state.watching ? "currentColor" : "none"} aria-hidden="true" />
        {state.watching ? "On watchlist" : "Watchlist"}
      </button>
      <span className="font-mono text-[10px] text-zinc-500">
        {state.followerCount} follower{state.followerCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
