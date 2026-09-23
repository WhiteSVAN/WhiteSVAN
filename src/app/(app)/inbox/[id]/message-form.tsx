"use client";

import { useActionState, useId } from "react";
import { Send } from "lucide-react";
import { sendInquiryMessage, type MessageState } from "../actions";
import { FormError, inputClass, labelClass } from "@/components/form";
import { THREAD_MESSAGE_MAX } from "@/lib/inquiries";

/** Reply box for an accepted inquiry. The server re-checks access + status. */
export function MessageForm({ inquiryId, recipientName }: { inquiryId: string; recipientName: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(sendInquiryMessage, undefined);
  const id = useId();

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <label htmlFor={`${id}-body`} className={labelClass}>
        Message to {recipientName}
      </label>
      <textarea
        id={`${id}-body`}
        name="body"
        required
        rows={4}
        maxLength={THREAD_MESSAGE_MAX}
        defaultValue={state?.body ?? ""}
        placeholder="Questions about the record, method, data sources, or a role…"
        className={`${inputClass} resize-y`}
      />
      <FormError message={state?.error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          Research and diligence only — no trade signals, copy trading, or managing money.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#baf277] bg-[#baf277] px-4 py-2 text-sm font-medium text-[#17200e] transition hover:bg-[#cdf995] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
