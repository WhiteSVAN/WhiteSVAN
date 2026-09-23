"use client";

import { useId, useState, useTransition } from "react";
import { FormError, inputClass, labelClass } from "@/components/form";
import { POST_LIMITS } from "@/lib/posts";
import { createComment } from "@/app/(app)/feed/actions";

/** Add a comment. Validation, rate limiting, and the language filter run on the server. */
export function CommentForm({ postId }: { postId: string }) {
  const uid = useId();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();

  return (
    <form
      key={formKey}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          const r = await createComment(data);
          if (r.ok) {
            setError(null);
            setFormKey((k) => k + 1);
          } else {
            setError(r.error);
          }
        });
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <div>
        <label htmlFor={`${uid}-body`} className={labelClass}>
          Add a comment
        </label>
        <textarea
          id={`${uid}-body`}
          name="body"
          required
          rows={3}
          maxLength={POST_LIMITS.comment}
          placeholder="Questions, counterpoints, sources…"
          className={inputClass}
        />
      </div>
      {error && <FormError message={error} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-zinc-500">Discuss methods and evidence. No calls to action.</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-60"
        >
          {pending ? "Posting…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
