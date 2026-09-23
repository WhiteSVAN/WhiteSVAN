/**
 * A trader's own non-community posts, newest first, for the public profile's
 * Posts tab. Works for signed-out visitors: likes/comments degrade to sign-in
 * links. Respects the trader's privacy — nothing renders for other viewers when
 * the profile is private or the Posts section is hidden.
 */
import { prisma } from "@/lib/db";
import { PostList } from "./post-list";

export async function ProfilePosts(props: { authorUserId: string; viewerId: string | null }) {
  const isOwner = props.viewerId === props.authorUserId;
  if (!isOwner) {
    const profile = await prisma.traderProfile.findUnique({
      where: { userId: props.authorUserId },
      select: { isPublic: true, hiddenSections: true },
    });
    if (!profile?.isPublic || profile.hiddenSections.includes("posts")) {
      return <p className="text-sm text-zinc-500">This trader keeps their posts private.</p>;
    }
  }
  return (
    <PostList
      query={{ viewerId: props.viewerId, authorIds: [props.authorUserId], communityId: null, limit: 20 }}
      emptyText={isOwner ? "You haven't posted yet. Share research from the feed." : "No posts yet."}
    />
  );
}
