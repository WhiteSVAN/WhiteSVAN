import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { POST_TYPES, POST_TYPE_DEFS, isPostType } from "@/lib/posts";
import { followedAuthorIds } from "@/lib/post-queries";
import { PostComposer } from "@/components/posts/post-composer";
import { PostList } from "@/components/posts/post-list";

export const metadata: Metadata = { title: "Feed - TrustSVAN" };

type Tab = "following" | "all";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function feedHref(tab: Tab, type: string | null): string {
  const params = new URLSearchParams({ tab });
  if (type) params.set("type", type);
  return `/feed?${params.toString()}`;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const followed = await followedAuthorIds(user.id);

  const tabParam = one(sp.tab);
  const tab: Tab = tabParam === "following" || tabParam === "all" ? tabParam : followed.length > 0 ? "following" : "all";
  const typeParam = one(sp.type);
  const type = isPostType(typeParam) ? typeParam : null;
  const cursor = one(sp.cursor) ?? null;
  const canPost = user.role === "TRADER" && !!user.profile;

  const tabClass = (active: boolean) =>
    `pb-3 text-sm ${active ? "-mb-px border-b-2 border-[#baf277] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`;
  const typeClass = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-xs ${active ? "border-[#baf277] text-[#dff5c4]" : "border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="terminal-label">Research network / structured posts</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Feed</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Market views, theses, trade reviews, and research from traders — each shown with the author&apos;s record
          source and coverage. Discussion only: no signals, calls to action, or allocation advice.
        </p>
      </div>

      {canPost ? (
        <PostComposer intro="Posts appear on the feed and on your public profile's Posts tab." />
      ) : (
        <div className="terminal-card p-5 text-sm text-zinc-400">
          {user.role === "CLIENT" ? (
            <>
              Clients can read, like, comment on, and flag posts. Posting to the main feed is for traders with a
              record — you can post inside any{" "}
              <Link href="/communities" className="text-zinc-200 underline-offset-2 hover:underline">
                community
              </Link>{" "}
              you&apos;ve joined.
            </>
          ) : (
            <>Finish your trader profile to post.</>
          )}
        </div>
      )}

      <section aria-label="Posts">
        <nav className="flex flex-wrap gap-6 border-b border-zinc-800" aria-label="Feed tabs">
          <Link
            href={feedHref("following", type)}
            className={tabClass(tab === "following")}
            aria-current={tab === "following" ? "page" : undefined}
          >
            Following
            <span className="ml-1.5 font-mono text-[10px] text-zinc-500" aria-label={`${followed.length} traders followed`}>
              {followed.length}
            </span>
          </Link>
          <Link href={feedHref("all", type)} className={tabClass(tab === "all")} aria-current={tab === "all" ? "page" : undefined}>
            All
          </Link>
        </nav>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter by post type">
          <Link href={feedHref(tab, null)} className={typeClass(!type)} aria-current={!type ? "true" : undefined}>
            All types
          </Link>
          {POST_TYPES.map((key) => (
            <Link key={key} href={feedHref(tab, key)} className={typeClass(type === key)} aria-current={type === key ? "true" : undefined}>
              {POST_TYPE_DEFS[key].label}
            </Link>
          ))}
        </nav>

        {cursor && (
          <p className="mt-4 text-xs text-zinc-500">
            Showing older posts ·{" "}
            <Link href={feedHref(tab, type)} className="text-zinc-300 hover:text-white">
              Back to newest
            </Link>
          </p>
        )}

        <div className="mt-5">
          <PostList
            query={{
              viewerId: user.id,
              authorIds: tab === "following" ? followed : undefined,
              communityId: null,
              type,
              cursor,
            }}
            moreHref={feedHref(tab, type)}
            emptyText={
              tab === "following"
                ? followed.length === 0
                  ? "You're not following anyone yet. Follow traders from the directory to build this tab."
                  : "No posts from the traders you follow yet."
                : "No posts yet."
            }
          />
          {tab === "following" && followed.length === 0 && (
            <p className="mt-3 text-center text-sm">
              <Link href="/explore" className="text-zinc-300 underline-offset-2 hover:underline">
                Browse traders
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
