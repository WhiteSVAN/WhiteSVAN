/**
 * One trader in the /explore directory. Server component: it renders the
 * factual record badge (server-only module) and is handed to the client
 * directory as a pre-rendered node, so filtering never needs the database.
 */
import Link from "next/link";
import { formatDistanceStrict } from "date-fns";
import { MessageSquare } from "lucide-react";
import { RecordBadge } from "@/components/record-badge";
import { FollowButtons } from "@/components/network/follow-buttons";
import type { DirectoryTrader } from "@/lib/directory";
import { formatDrawdown, formatExperience, formatReturn, hasDeclaredRegistration } from "@/lib/directory-filters";
import { optionLabel, optionLabels } from "@/lib/profile-options";

const MAX_CHIPS = 3;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function Chips({
  labels,
  tone = "default",
  max = MAX_CHIPS,
}: {
  labels: string[];
  tone?: "default" | "muted";
  max?: number;
}) {
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;
  const cls =
    tone === "muted"
      ? "border-[#2f3a31] text-[#8f9c8d]"
      : "border-[#3a4a37] bg-[#141c15] text-[#c3d2ba]";
  return (
    <>
      {shown.map((label) => (
        <li key={label} className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>
          {label}
        </li>
      ))}
      {extra > 0 && (
        <li className="rounded border border-[#2f3a31] px-1.5 py-0.5 text-[10px] text-[#7f8c80]" title={labels.slice(max).join(", ")}>
          +{extra}
        </li>
      )}
    </>
  );
}

export function DirectoryCard({
  trader,
  signedIn,
  now,
}: {
  trader: DirectoryTrader;
  signedIn: boolean;
  now: Date;
}) {
  const href = `/p/${trader.slug}`;
  const region = optionLabel("regions", trader.region);
  const capital = optionLabel("capitalBands", trader.capitalBand);
  const experience = formatExperience(trader.experienceYears);
  const registration = hasDeclaredRegistration(trader.registrationType)
    ? `${optionLabel("registrationTypes", trader.registrationType)} · self-declared`
    : null;
  const hasPerformance = trader.returnPct != null || trader.maxDrawdownPct != null;
  const updated = formatDistanceStrict(new Date(trader.lastActive), now, { addSuffix: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#4d603c] bg-[#23321c] font-mono text-[10px] text-[#cce1b6]"
        >
          {initials(trader.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={href} className="min-w-0 break-words text-base font-medium text-[#e8eee3] hover:text-[#baf277]">
              {trader.displayName}
            </Link>
            {trader.acceptInquiries && (
              <span className="inline-flex items-center gap-1 rounded border border-[#3f5a2c] px-1.5 py-0.5 text-[10px] text-[#bfe09a]">
                <MessageSquare className="h-3 w-3" aria-hidden="true" /> Accepting conversation requests
              </span>
            )}
          </div>
          {(trader.headline || trader.strategy) && (
            <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[#8f9c8d]">{trader.headline || trader.strategy}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <RecordBadge record={trader.record} slug={trader.slug} compact />
        <p className="text-[10px] text-[#768377]">
          Updated <time dateTime={trader.lastActive}>{updated}</time>
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Profile details">
        <Chips labels={optionLabels("markets", trader.markets)} />
        <Chips labels={optionLabels("strategyTags", trader.strategyTags)} />
        {/* Identity context is never truncated: region, experience, capital band, registration. */}
        <Chips labels={[region, experience, capital, registration].filter((v): v is string => !!v)} tone="muted" max={4} />
      </ul>

      {hasPerformance && (
        <div className="rounded-md border border-[#2a352c] px-3 py-2.5">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-wider text-[#6f7c70]">Period return</dt>
              <dd className="mt-1 font-mono text-sm text-[#d4ddd0]">{formatReturn(trader.returnPct)}</dd>
            </div>
            <div className="border-l border-[#2f3b31] pl-3">
              <dt className="font-mono text-[9px] uppercase tracking-wider text-[#6f7c70]">Max drawdown</dt>
              <dd className="mt-1 font-mono text-sm text-[#d4ddd0]">{formatDrawdown(trader.maxDrawdownPct)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[9px] text-[#6f7c70]">Historical, over the published window. Not a forecast.</p>
        </div>
      )}

      <FollowButtons
        profileId={trader.profileId}
        following={trader.following}
        watching={trader.watching}
        followerCount={trader.followerCount}
        signedIn={signedIn}
        isOwner={trader.isOwner}
        size="sm"
      />
    </div>
  );
}
