/**
 * One structured post. Server component: the body is rendered as plain text
 * (whitespace-pre-wrap, never HTML), the record context is factual (source ·
 * coverage), and the verified-position badge appears only when the server
 * matched an imported execution.
 */
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { BadgeCheck, MessageSquare, Users } from "lucide-react";
import { RecordBadge } from "@/components/record-badge";
import type { PostView } from "@/lib/post-queries";
import { DeletePostButton, FlagControl, LikeButton } from "./post-interactions";

function initials(name: string): string {
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

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PostCard({
  post,
  viewerId,
  detail = false,
  showCommunity = false,
}: {
  post: PostView;
  viewerId: string | null;
  /** On the post's own page: title isn't a link and the comment count isn't repeated. */
  detail?: boolean;
  /** Show which community the post belongs to. */
  showCommunity?: boolean;
}) {
  const signedIn = !!viewerId;
  const created = new Date(post.createdAt);
  const TitleTag = detail ? "h1" : "h3";

  return (
    <article className="terminal-card min-w-0 p-4 sm:p-5">
      <header className="flex flex-wrap items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#4d603c] bg-[#23321c] font-mono text-[10px] text-[#cce1b6]"
          aria-hidden="true"
        >
          {initials(post.author.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {post.author.slug ? (
              <Link href={`/p/${post.author.slug}`} className="truncate text-sm font-medium text-zinc-100 hover:text-[#baf277]">
                {post.author.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium text-zinc-100">{post.author.name}</span>
            )}
            {post.author.role === "CLIENT" && (
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                Client
              </span>
            )}
            <time dateTime={post.createdAt} title={created.toUTCString()} className="font-mono text-[10px] text-zinc-500">
              {formatDistanceToNowStrict(created, { addSuffix: true })}
            </time>
          </div>
          <div className="mt-0.5">
            {post.author.role === "CLIENT" ? (
              <span className="text-[10px] text-zinc-500">Allocator / reviewer account</span>
            ) : (
              <RecordBadge record={post.record} slug={post.record?.slug} compact />
            )}
          </div>
        </div>
        <span className="rounded-md border border-[#3c4a36] bg-[#141c16] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#c5d9ad]">
          {post.typeLabel}
        </span>
      </header>

      {showCommunity && post.community && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Posted in{" "}
          <Link href={`/communities/${post.community.slug}`} className="text-zinc-300 hover:text-white">
            {post.community.name}
          </Link>
        </p>
      )}

      <TitleTag className={`mt-3 break-words font-medium text-zinc-100 ${detail ? "text-xl" : "text-base"}`}>
        {detail ? (
          post.title
        ) : (
          <Link href={`/feed/${post.id}`} className="hover:text-[#baf277]">
            {post.title}
          </Link>
        )}
      </TitleTag>

      {post.symbols.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Symbols">
          {post.symbols.map((s) => (
            <li key={s} className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
              ${s}
            </li>
          ))}
        </ul>
      )}

      {post.verified && (
        <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-md border border-[#57733a] bg-[#1a2418] px-2.5 py-1 text-[11px] text-[#dff5c4]">
          <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Matches an imported execution · {post.verified.symbol} · {dayLabel(post.verified.date)}
        </p>
      )}
      {post.reviewUnmatched && (
        <p className="mt-3 text-[11px] text-zinc-500">No matching imported execution</p>
      )}

      {post.attachedRecord && (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
          <p className="terminal-label">Attached record</p>
          <div className="mt-1">
            <RecordBadge record={post.attachedRecord} slug={post.author.slug ?? undefined} />
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Past performance does not guarantee future results.</p>
        </div>
      )}

      {post.fields.length > 0 && (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {post.fields.map((f) => (
            <div
              key={f.key}
              className={`min-w-0 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 ${f.value.length > 60 ? "sm:col-span-2" : ""}`}
            >
              <dt className="terminal-label">{f.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div
        className={`mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300 ${detail ? "" : "line-clamp-12"}`}
      >
        {post.body}
      </div>
      {!detail && post.body.length > 700 && signedIn && (
        <Link href={`/feed/${post.id}`} className="mt-1 inline-block text-xs text-zinc-400 hover:text-white">
          Read the full post
        </Link>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
        <LikeButton postId={post.id} liked={post.liked} count={post.likeCount} signedIn={signedIn} />
        {!detail && (
          <Link
            href={signedIn ? `/feed/${post.id}` : "/login"}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-400 hover:text-white"
            aria-label={signedIn ? `${post.commentCount} comments — open discussion` : "Sign in to comment"}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {signedIn ? post.commentCount : `Sign in to comment · ${post.commentCount}`}
          </Link>
        )}
        {signedIn && !post.isAuthor && <FlagControl postId={post.id} flagged={post.flagged} />}
        {post.isAuthor ? (
          <DeletePostButton postId={post.id} />
        ) : (
          post.canModerate && <DeletePostButton postId={post.id} label="Remove (admin)" />
        )}
      </footer>
      <p className="mt-2 text-[10px] text-zinc-500">Research discussion — not investment advice.</p>
    </article>
  );
}
