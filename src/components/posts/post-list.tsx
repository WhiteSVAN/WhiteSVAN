/**
 * Server-rendered page of posts with keyset "Load more". Shared by /feed,
 * community pages, PostFeed, and ProfilePosts; visibility is enforced inside
 * listPosts (community access + removed posts).
 */
import Link from "next/link";
import { listPosts, type PostListQuery } from "@/lib/post-queries";
import { PostCard } from "./post-card";

/** Append `cursor=` to a URL that may already carry a query string. */
function withCursor(base: string, cursor: string): string {
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  params.set("cursor", cursor);
  return `${path}?${params.toString()}`;
}

export async function PostList({
  query,
  emptyText = "No posts yet.",
  hiddenText = "These posts are visible to community members only.",
  moreHref,
  showCommunity = false,
}: {
  query: PostListQuery;
  emptyText?: string;
  hiddenText?: string;
  /** Base URL for "Load more"; omitted ⇒ no pagination link. */
  moreHref?: string;
  showCommunity?: boolean;
}) {
  const { posts, nextCursor, hidden } = await listPosts(query);

  if (hidden) return <p className="text-sm text-zinc-500">{hiddenText}</p>;
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        {query.cursor ? "No older posts." : emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} viewerId={query.viewerId} showCommunity={showCommunity} />
      ))}
      {nextCursor && moreHref && (
        <div className="flex justify-center pt-2">
          <Link
            href={withCursor(moreHref, nextCursor)}
            className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-zinc-400 hover:text-white"
            scroll={false}
          >
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
