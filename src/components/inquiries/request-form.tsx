"use client";

/**
 * Client → trader "request a conversation" form. Collapsed behind a button so
 * the profile stays calm; the server action re-validates everything.
 */
import { useActionState, useId, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { createInquiry, type RequestState } from "@/app/(app)/inbox/actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";
import { INQUIRY_TOPICS } from "@/lib/profile-options";
import { REQUEST_MESSAGE_MAX, REQUEST_MESSAGE_MIN } from "@/lib/inquiries";

export function RequestForm({ profileId, traderName }: { profileId: string; traderName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RequestState, FormData>(createInquiry, undefined);
  // `typed` is null until the user edits after the last submit; then the counter
  // falls back to the value restored from the server state.
  const [typed, setTyped] = useState<{ state: RequestState; length: number } | null>(null);
  const length = typed && typed.state === state ? typed.length : (state?.values?.message.length ?? 0);
  const id = useId();

  if (state?.ok) {
    return (
      <p role="status" className="mt-3 text-sm text-zinc-200">
        Request sent. You&apos;ll get an inbox notification when {traderName} responds.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#baf277] bg-[#baf277] px-4 py-2 text-sm font-medium text-[#17200e] transition hover:bg-[#cdf995]"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        Request a conversation
      </button>
    );
  }

  const topicId = `${id}-topic`;
  const messageId = `${id}-message`;
  const noticeId = `${id}-notice`;

  return (
    <form action={action} className="mt-4 space-y-4" aria-describedby={noticeId}>
      <input type="hidden" name="profileId" value={profileId} />

      <div>
        <label htmlFor={topicId} className={labelClass}>
          Topic
        </label>
        <select
          id={topicId}
          name="topic"
          required
          defaultValue={state?.values?.topic ?? ""}
          aria-invalid={Boolean(state?.fieldErrors?.topic)}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a topic
          </option>
          {INQUIRY_TOPICS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <FieldError messages={state?.fieldErrors?.topic ? [state.fieldErrors.topic] : undefined} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={messageId} className={labelClass}>
            Message
          </label>
          <span className="font-mono text-[10px] text-zinc-500" aria-live="polite">
            {length}/{REQUEST_MESSAGE_MAX}
          </span>
        </div>
        <textarea
          id={messageId}
          name="message"
          required
          rows={5}
          minLength={REQUEST_MESSAGE_MIN}
          maxLength={REQUEST_MESSAGE_MAX}
          defaultValue={state?.values?.message ?? ""}
          onChange={(e) => setTyped({ state, length: e.currentTarget.value.length })}
          aria-invalid={Boolean(state?.fieldErrors?.message)}
          placeholder={`What would you like to discuss with ${traderName}? (${REQUEST_MESSAGE_MIN}+ characters)`}
          className={`${inputClass} resize-y`}
        />
        <FieldError messages={state?.fieldErrors?.message ? [state.fieldErrors.message] : undefined} />
      </div>

      <p id={noticeId} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs leading-5 text-zinc-400">
        Your name, organization and client type are shared with the trader. Requests for trade signals, copy
        trading, or managing your money aren&apos;t allowed.
      </p>

      <FormError message={state?.error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto`}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="min-h-11 rounded-md border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
