/**
 * Presentational bits shared by the inquiry surfaces (profile block, inbox,
 * dashboard card). No hooks — safe in Server and Client Components.
 */
import { format, formatDistanceStrict } from "date-fns";
import { inquiryStatusLabel, type InquiryStatusKey, type Perspective } from "@/lib/inquiries";
import { optionLabel } from "@/lib/profile-options";

const STATUS_TONE: Record<InquiryStatusKey, string> = {
  PENDING: "border-[#57733a] bg-[#1a2418] text-[#dff5c4]",
  ACCEPTED: "border-[#baf277]/50 bg-[#baf277]/10 text-[#baf277]",
  DECLINED: "border-zinc-700 text-zinc-400",
  IGNORED: "border-zinc-700 text-zinc-500",
};

export function InquiryStatusBadge({
  status,
  perspective,
}: {
  status: InquiryStatusKey;
  perspective: Perspective;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${STATUS_TONE[status]}`}
    >
      {inquiryStatusLabel(status, perspective)}
    </span>
  );
}

/** "3 hours ago" for the last week, then a calendar date. Compute on the server. */
export function whenLabel(date: Date, now: Date = new Date()): string {
  const ageMs = now.getTime() - date.getTime();
  if (ageMs < 60_000) return "just now";
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return `${formatDistanceStrict(date, now)} ago`;
  return format(date, "MMM d, yyyy");
}

export function utcTitle(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Relative time with the full UTC timestamp on hover. Server Components only. */
export function When({ date, className = "" }: { date: Date; className?: string }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={utcTitle(date)}
      className={`font-mono text-[10px] text-zinc-500 ${className}`}
    >
      {whenLabel(date)}
    </time>
  );
}

/** Who the client is — the only client details a trader ever sees. */
export function ClientIdentity({
  name,
  organization,
  clientType,
}: {
  name: string | null;
  organization: string | null | undefined;
  clientType: string | null | undefined;
}) {
  const type = optionLabel("clientTypes", clientType);
  return (
    <span className="min-w-0">
      <span className="font-medium text-zinc-100">{name?.trim() || "Unnamed client"}</span>
      {(organization || type) && (
        <span className="block text-xs text-zinc-400">
          {[organization?.trim(), type].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  );
}

export function topicLabel(topic: string): string {
  return optionLabel("inquiryTopics", topic) ?? topic;
}

export const GUARDRAIL_NOTE =
  "Requests for trade signals, copy trading, or managing your money aren't allowed.";
