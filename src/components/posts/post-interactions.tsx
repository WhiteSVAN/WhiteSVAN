"use client";

/**
 * Interactive bits of a post card: like, flag, and remove. Signed-out viewers
 * get sign-in links instead. Every action is re-authorized on the server.
 */
import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, Heart, Trash2 } from "lucide-react";
import { FLAG_REASONS, POST_LIMITS } from "@/lib/posts";
import { deleteComment, deletePost, flagPost, toggleLike } from "@/app/(app)/feed/actions";

const chip =
  "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-60";
const chipOff = "border-zinc-800 text-zinc-400 hover:border-zinc-400 hover:text-white";
const chipOn = "border-[#57733a] bg-[#1a2418] text-[#dff5c4]";

export function LikeButton({
  postId,
  liked,
  count,
  signedIn,
}: {
  postId: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useOptimistic({ liked, count }, (_cur, next: { liked: boolean; count: number }) => next);

  if (!signedIn) {
    return (
      <Link href="/login" className={`${chip} ${chipOff}`} aria-label={`Sign in to like (${count} likes)`}>
        <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {count}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={state.liked}
        aria-label={state.liked ? `Unlike (${state.count} likes)` : `Like (${state.count} likes)`}
        onClick={() =>
          start(async () => {
            setError(null);
            setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
            const r = await toggleLike(postId);
            if (!r.ok) setError(r.error);
          })
        }
        className={`${chip} ${state.liked ? chipOn : chipOff}`}
      >
        <Heart className="h-3.5 w-3.5" fill={state.liked ? "currentColor" : "none"} aria-hidden="true" />
        {state.count}
      </button>
      {error && (
        <span className="text-[11px] text-zinc-400" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

export function FlagControl({ postId, flagged }: { postId: string; flagged: boolean }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(flagged);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return <span className="inline-flex min-h-8 items-center text-[11px] text-zinc-500">Flagged for review</span>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${chip} ${chipOff}`} aria-expanded={false}>
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Flag
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          const r = await flagPost(data);
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <div className="min-w-0 sm:flex-1">
        <label htmlFor={`${uid}-reason`} className="block font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
          Reason
        </label>
        <select
          id={`${uid}-reason`}
          name="reason"
          required
          defaultValue=""
          className="mt-1 block min-h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200"
        >
          <option value="" disabled>
            Choose…
          </option>
          {FLAG_REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 sm:flex-1">
        <label htmlFor={`${uid}-note`} className="block font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
          Note (optional)
        </label>
        <input
          id={`${uid}-note`}
          name="note"
          type="text"
          maxLength={POST_LIMITS.flagNote}
          className="mt-1 block min-h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${chip} ${chipOn}`}>
          {pending ? "Sending…" : "Send flag"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${chip} ${chipOff}`}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="w-full text-[11px] text-zinc-300" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function DeletePostButton({ postId, label = "Delete" }: { postId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Remove this post? It will no longer be shown anywhere.")) return;
          start(async () => {
            const r = await deletePost(postId);
            if (!r.ok) setError(r.error);
          });
        }}
        className={`${chip} ${chipOff}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {pending ? "Removing…" : label}
      </button>
      {error && (
        <span className="text-[11px] text-zinc-400" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this comment?")) return;
          start(async () => {
            const r = await deleteComment(commentId);
            if (!r.ok) setError(r.error);
          });
        }}
        className="text-[11px] text-zinc-500 underline-offset-2 hover:text-white hover:underline disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span className="text-[11px] text-zinc-400" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
