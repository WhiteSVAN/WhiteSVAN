// CONTRACT STUB — owned by the Social agent; replace the body, keep the signature.
/**
 * A list of posts. Filters: `authorIds` (e.g. traders the viewer follows),
 * `communityId` (community-scoped posts; omitted ⇒ only non-community posts).
 */
export async function PostFeed(props: {
  viewerId: string | null;
  authorIds?: string[];
  communityId?: string;
  limit?: number;
  emptyText?: string;
}) {
  return <p className="text-sm text-zinc-500">{props.emptyText ?? "No posts yet."}</p>;
}
