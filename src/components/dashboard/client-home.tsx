/**
 * Client home (/dashboard for CLIENT users): private watchlist, followed
 * traders and their posts, sent conversation requests, and public traders that
 * match the client's stated preferences. Everything here is scoped to `userId`,
 * which the page resolved from the session — never from input.
 */
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Bookmark, Inbox, Sparkles, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { loadDirectory } from "@/lib/directory";
import { RECORD_VERSION_SELECT, toRecordContext } from "@/lib/record-context";
import { optionLabel, optionLabels } from "@/lib/profile-options";
import { RecordBadge } from "@/components/record-badge";
import { FollowButtons } from "@/components/network/follow-buttons";
import { PostFeed } from "@/components/posts/post-feed";
import { hasPreferences, pickMatches } from "@/app/(app)/dashboard/matching";
import { clearHiddenWatchlist } from "@/app/(app)/dashboard/actions";

const PROFILE_CARD_SELECT = {
  id: true,
  userId: true,
  slug: true,
  displayName: true,
  headline: true,
  isPublic: true,
  updatedAt: true,
  _count: { select: { userFollows: true } },
  versions: { orderBy: { versionNumber: "desc" }, take: 1, select: RECORD_VERSION_SELECT },
} as const;

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Request sent", className: "border-zinc-700 text-zinc-300" },
  ACCEPTED: { label: "Accepted", className: "border-[#57733a] bg-[#1a2418] text-[#dff5c4]" },
  DECLINED: { label: "Declined", className: "border-zinc-800 text-zinc-500" },
  IGNORED: { label: "No response", className: "border-zinc-800 text-zinc-500" },
};

function ago(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function lastUpdated(p: { updatedAt: Date; versions: { publishedAt: Date }[] }): Date {
  const v = p.versions[0]?.publishedAt;
  return v && v > p.updatedAt ? v : p.updatedAt;
}

export async function ClientHome({ userId, name }: { userId: string; name: string | null }) {
  const [prefs, watchRows, followRows, inquiries, directory] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { userId },
      select: { markets: true, regions: true, strategyTags: true, organization: true },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { profile: { select: PROFILE_CARD_SELECT } },
    }),
    prisma.follow.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { profile: { select: PROFILE_CARD_SELECT } },
    }),
    prisma.inquiry.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        topic: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        profile: { select: { slug: true, displayName: true, isPublic: true } },
      },
    }),
    loadDirectory(userId),
  ]);

  const watched = watchRows.map((w) => w.profile).filter((p) => p.isPublic);
  const hiddenWatched = watchRows.length - watched.length;
  const followed = followRows.map((f) => f.profile).filter((p) => p.isPublic);
  const followSet = new Set(followed.map((p) => p.id));
  const watchSet = new Set(watched.map((p) => p.id));
  const followedUserIds = followed.map((p) => p.userId);

  const preferences = prefs
    ? { markets: prefs.markets, regions: prefs.regions, strategyTags: prefs.strategyTags }
    : null;
  const usingPrefs = hasPreferences(preferences);
  const matches = pickMatches(directory, preferences, 6);
  const prefLabels = preferences
    ? [
        ...optionLabels("markets", preferences.markets),
        ...optionLabels("regions", preferences.regions),
        ...optionLabels("strategyTags", preferences.strategyTags),
      ]
    : [];
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="terminal-label">Client workspace / private by default</p>
          <h1 className="mt-2 break-words text-3xl font-medium tracking-[-0.04em] text-zinc-900">
            {firstName ? `Welcome back, ${firstName}` : "Home"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            {prefLabels.length > 0 ? (
              <>
                Looking for: <span className="text-zinc-300">{prefLabels.join(" · ")}</span>.{" "}
              </>
            ) : (
              "No discovery preferences set yet. "
            )}
            <Link href="/settings" className="text-[#baf277] hover:underline">
              Edit preferences
            </Link>
          </p>
        </div>
        <Link
          href="/explore"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-white"
        >
          Discover traders <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {/* Matching preferences */}
          <section className="terminal-card p-5" aria-labelledby="matches-heading">
            <SectionHead
              id="matches-heading"
              icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
              title={usingPrefs ? "Matching your preferences" : "Recently updated traders"}
              action={<Link href="/explore" className="text-xs text-[#baf277] hover:underline">See all in Traders</Link>}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Most recently updated first — never ordered by return or score.
            </p>
            {matches.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                {usingPrefs
                  ? "No public traders match all of your preferences yet. Widen them in settings or browse every trader."
                  : "No public trader records yet."}
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {matches.map((t) => (
                  <li key={t.profileId} className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <Link href={`/p/${t.slug}`} className="block truncate text-sm font-medium text-zinc-100 hover:text-[#baf277]">
                      {t.displayName}
                    </Link>
                    {t.headline && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{t.headline}</p>}
                    <p className="mt-2 flex flex-wrap gap-1">
                      {[...optionLabels("markets", t.markets).slice(0, 3), optionLabel("regions", t.region)]
                        .filter(Boolean)
                        .map((label) => (
                          <span key={label} className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {label}
                          </span>
                        ))}
                    </p>
                    <div className="mt-2">
                      <RecordBadge record={t.record} slug={t.slug} compact />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <FollowButtons
                        profileId={t.profileId}
                        following={t.following}
                        watching={t.watching}
                        followerCount={t.followerCount}
                        signedIn
                        size="sm"
                      />
                      <span className="text-[10px] text-zinc-500">Updated {ago(new Date(t.lastActive))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Posts from followed traders */}
          <section className="terminal-card p-5" aria-labelledby="feed-heading">
            <SectionHead
              id="feed-heading"
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              title="From traders you follow"
              action={<Link href="/feed" className="text-xs text-[#baf277] hover:underline">Open feed</Link>}
            />
            <div className="mt-4">
              {followedUserIds.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Follow traders to see their research posts and record updates here.
                </p>
              ) : (
                <PostFeed
                  viewerId={userId}
                  authorIds={followedUserIds}
                  limit={10}
                  emptyText="No posts from traders you follow yet."
                />
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Private watchlist */}
          <section className="terminal-card p-5" aria-labelledby="watchlist-heading">
            <SectionHead
              id="watchlist-heading"
              icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
              title="Watchlist"
              action={<span className="font-mono text-[10px] text-zinc-500">Private to you</span>}
            />
            {watched.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                Nothing saved yet. Use <span className="text-zinc-300">Watchlist</span> on any trader
                to track them privately — the trader is never told.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-800">
                {watched.map((p) => {
                  const record = p.versions[0] ? toRecordContext(p.versions[0]) : null;
                  return (
                    <li key={p.id} className="min-w-0 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <Link href={`/p/${p.slug}`} className="min-w-0 truncate text-sm font-medium text-zinc-100 hover:text-[#baf277]">
                          {p.displayName}
                        </Link>
                        <span className="text-[10px] text-zinc-500">Updated {ago(lastUpdated(p))}</span>
                      </div>
                      <div className="mt-1">
                        <RecordBadge record={record} slug={p.slug} />
                      </div>
                      <div className="mt-2">
                        <FollowButtons
                          profileId={p.id}
                          following={followSet.has(p.id)}
                          watching={watchSet.has(p.id)}
                          followerCount={p._count.userFollows}
                          signedIn
                          size="sm"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {hiddenWatched > 0 && (
              <form action={clearHiddenWatchlist} className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>
                  {hiddenWatched} saved {hiddenWatched === 1 ? "profile is" : "profiles are"} now private.
                </span>
                <button type="submit" className="text-zinc-300 underline hover:text-white">
                  Remove {hiddenWatched === 1 ? "it" : "them"}
                </button>
              </form>
            )}
          </section>

          {/* Following */}
          <section className="terminal-card p-5" aria-labelledby="following-heading">
            <SectionHead
              id="following-heading"
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              title="Following"
              action={<span className="font-mono text-[10px] text-zinc-500">{followed.length}</span>}
            />
            {followed.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">You aren&apos;t following anyone yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-800">
                {followed.map((p) => {
                  const record = p.versions[0] ? toRecordContext(p.versions[0]) : null;
                  return (
                    <li key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/p/${p.slug}`} className="block truncate text-sm text-zinc-100 hover:text-[#baf277]">
                          {p.displayName}
                        </Link>
                        <RecordBadge record={record} compact />
                      </div>
                      <FollowButtons
                        profileId={p.id}
                        following
                        watching={watchSet.has(p.id)}
                        followerCount={p._count.userFollows}
                        signedIn
                        size="sm"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Sent requests */}
          <section className="terminal-card p-5" aria-labelledby="requests-heading">
            <SectionHead
              id="requests-heading"
              icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
              title="Conversation requests"
              action={<Link href="/inbox" className="text-xs text-[#baf277] hover:underline">Open inbox</Link>}
            />
            {inquiries.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                You haven&apos;t requested a conversation yet. Traders who accept requests show a
                &ldquo;Request a conversation&rdquo; option on their profile.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-800">
                {inquiries.map((q) => {
                  const status = STATUS[q.status] ?? STATUS.PENDING;
                  return (
                    <li key={q.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        {q.profile.isPublic ? (
                          <Link href={`/p/${q.profile.slug}`} className="block truncate text-sm text-zinc-100 hover:text-[#baf277]">
                            {q.profile.displayName}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm text-zinc-300">{q.profile.displayName}</span>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {optionLabel("inquiryTopics", q.topic)} · sent {ago(q.createdAt)}
                        </span>
                      </div>
                      {q.status === "ACCEPTED" ? (
                        <Link href="/inbox" className={`rounded border px-2 py-0.5 text-[10px] ${status.className}`}>
                          {status.label} · open thread
                        </Link>
                      ) : (
                        <span className={`rounded border px-2 py-0.5 text-[10px] ${status.className}`}>{status.label}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  id,
  icon,
  title,
  action,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-base font-medium text-zinc-800">
        <span className="text-[#baf277]">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
  );
}
