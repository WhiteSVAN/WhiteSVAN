"use client";

/**
 * Trader's Accept / Decline / Ignore controls for one inquiry. Only the
 * decisions valid from the current status are shown; the server action
 * re-checks ownership and the transition.
 */
import { useActionState } from "react";
import { respondToInquiry, type RespondState } from "@/app/(app)/inbox/actions";
import { availableDecisions, type Decision, type InquiryStatusKey } from "@/lib/inquiries";

const LABEL: Record<Decision, string> = { accept: "Accept", decline: "Decline", ignore: "Ignore" };

export function RespondButtons({
  inquiryId,
  status,
  clientName,
  size = "md",
}: {
  inquiryId: string;
  status: InquiryStatusKey;
  /** Used in accessible labels ("Accept request from …"). */
  clientName: string;
  size?: "sm" | "md";
}) {
  const [state, action, pending] = useActionState<RespondState, FormData>(respondToInquiry, undefined);
  const decisions = availableDecisions(status);
  if (decisions.length === 0) return null;

  const pad = size === "sm" ? "min-h-8 px-2.5 py-1 text-[11px]" : "min-h-9 px-3 py-1.5 text-xs";
  const base = `inline-flex items-center justify-center rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${pad}`;
  const tone: Record<Decision, string> = {
    accept: "border-[#baf277] bg-[#baf277] text-[#17200e] hover:bg-[#cdf995]",
    decline: "border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white",
    ignore: "border-transparent text-zinc-400 hover:text-white",
  };

  return (
    <form action={action} aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      {decisions.map((d) => (
        <button
          key={d}
          type="submit"
          name="decision"
          value={d}
          disabled={pending}
          aria-label={`${LABEL[d]} request from ${clientName}`}
          onClick={(e) => {
            if (d === "decline" && !window.confirm(`Decline ${clientName}'s request? They'll be notified, and this can't be undone.`)) {
              e.preventDefault();
            }
          }}
          className={`${base} ${tone[d]}`}
        >
          {LABEL[d]}
        </button>
      ))}
      {pending && <span className="font-mono text-[10px] text-zinc-500">Saving…</span>}
      {state?.error && (
        <p role="alert" className="w-full text-xs text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
