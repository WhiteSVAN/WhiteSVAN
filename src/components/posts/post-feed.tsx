/**
 * A list of posts. Filters: `authorIds` (e.g. traders the viewer follows),
 * `communityId` (community-scoped posts; omitted ⇒ only non-community posts).
 * Community visibility is enforced inside listPosts: public communities need a
 * signed-in viewer, private ones an active membership.
 *
 * Optional `cursor` + `moreHref` add keyset "Load more" pagination.
 */
import { PostList } from "./post-list";

export async function PostFeed(props: {
  viewerId: string | null;
  authorIds?: string[];
  communityId?: string;
  limit?: number;
  emptyText?: string;
  cursor?: string | null;
  moreHref?: string;
}) {
  return (
    <PostList
      query={{
        viewerId: props.viewerId,
        authorIds: props.authorIds,
        communityId: props.communityId ?? null,
        limit: props.limit,
        cursor: props.cursor ?? null,
      }}
      moreHref={props.moreHref}
      emptyText={props.emptyText ?? "No posts yet."}
      hiddenText={props.viewerId ? "These posts are visible to community members only." : "Sign in to read community posts."}
    />
  );
}
