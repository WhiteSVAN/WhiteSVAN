import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { listComments, loadPostView, postAccess } from "@/lib/post-queries";
import { PostCard } from "@/components/posts/post-card";
import { CommentForm } from "@/components/posts/comment-form";
import { DeleteCommentButton } from "@/components/posts/post-interactions";

export const metadata: Metadata = { title: "Post - TrustSVAN" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  // Visibility (removed posts, community membership) is enforced here and again in every action.
  const access = await postAccess(id, user.id);
  const post = access ? await loadPostView(access, user.id) : null;

  if (!access || !post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to feed
        </Link>
        <div className="terminal-card p-6">
          <h1 className="text-lg font-medium text-zinc-100">Post unavailable</h1>
          <p className="mt-1 text-sm text-zinc-500">
            It was removed, or it belongs to a community you&apos;re not a member of.
          </p>
        </div>
      </div>
    );
  }

  const comments = await listComments(access, user.id);
  const back = post.community
    ? { href: `/communities/${post.community.slug}`, label: `Back to ${post.community.name}` }
    : { href: "/feed", label: "Back to feed" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {back.label}
      </Link>

      <PostCard post={post} viewerId={user.id} detail showCommunity />

      <section className="terminal-card p-5 sm:p-6" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-base font-medium text-zinc-800">
          Discussion <span className="font-mono text-xs text-zinc-500">{comments.length}</span>
        </h2>

        {comments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No comments yet.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="min-w-0 border-b border-zinc-800 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {c.author.slug ? (
                    <Link href={`/p/${c.author.slug}`} className="text-sm font-medium text-zinc-200 hover:text-[#baf277]">
                      {c.author.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-zinc-200">{c.author.name}</span>
                  )}
                  {c.author.id === post.author.id && (
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                      Author
                    </span>
                  )}
                  {c.author.role === "CLIENT" && (
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                      Client
                    </span>
                  )}
                  <time dateTime={c.createdAt} className="font-mono text-[10px] text-zinc-500">
                    {formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}
                  </time>
                  {c.canDelete && (
                    <span className="ml-auto">
                      <DeleteCommentButton commentId={c.id} />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{c.body}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-6 border-t border-zinc-800 pt-5">
          <CommentForm postId={post.id} />
        </div>
      </section>
    </div>
  );
}
