"use client";

import { useId, useState, useTransition } from "react";
import type { CommunityActionResult } from "@/lib/communities";

/** Inline private admin note on a member (visible to owners/admins only). */
export function AdminNoteForm({
  action,
  communityId,
  memberId,
  note,
  maxLength,
}: {
  action: (formData: FormData) => Promise<CommunityActionResult>;
  communityId: string;
  memberId: string;
  note: string;
  maxLength: number;
}) {
  const uid = useId();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  return (
    <form
      className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          const r = await action(data);
          setMessage(r.ok ? { text: r.message ?? "Saved.", error: false } : { text: r.error, error: true });
        });
      }}
    >
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="memberId" value={memberId} />
      <label htmlFor={`${uid}-note`} className="sr-only">
        Admin note
      </label>
      <input
        id={`${uid}-note`}
        name="adminNote"
        defaultValue={note}
        maxLength={maxLength}
        placeholder="Private admin note"
        className="min-h-8 min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200 placeholder-zinc-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-8 items-center rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {message && (
          <span className={`text-[11px] ${message.error ? "text-zinc-300" : "text-[#dff5c4]"}`} role="status">
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
