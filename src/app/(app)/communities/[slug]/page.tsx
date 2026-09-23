import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Lock, Settings } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { communityAccessBySlug } from "@/lib/post-queries";
import { COMMUNITY_GUARDRAIL, ROLE_LABEL, canLeave } from "@/lib/communities";
import { RecordBadge } from "@/components/record-badge";
import { ActionButton } from "@/components/communities/action-button";
import { PostComposer } from "@/components/posts/post-composer";
import { PostFeed } from "@/components/posts/post-feed";
import { POST_TYPES } from "@/lib/posts";
import { communityDetail, communityRoster } from "../queries";
import { cancelJoinRequest, joinCommunity, leaveCommunity } from "../actions";

export const metadata: Metadata = { title: "Community - TrustSVAN" };

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireOnboardedUser();
  const access = await communityAccessBySlug(slug, user.id);
  if (!access) notFound();
  const { community, membership } = access;
  const fields = { communityId: community.id };

  const membershipControls = (() => {
    if (!membership) {
      const open = community.visibility === "PUBLIC" && !community.requireApproval;
      return (
        <ActionButton
          action={joinCommunity}
          fields={fields}
          label={open ? "Join community" : community.visibility === "PRIVATE" ? "Request access" : "Request to join"}
          pendingLabel="Sending…"
          variant="primary"
        />
      );
    }
    if (membership.status === "PENDING") {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-zinc-400">Join request pending approval.</span>
          <ActionButton action={cancelJoinRequest} fields={fields} label="Withdraw request" size="sm" />
        </div>
      );
    }
    if (membership.status === "REMOVED") {
      return (
        <p className="text-sm text-zinc-400">
          You were removed from this community. You can return only with an invite link from an admin.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-[#57733a] bg-[#1a2418] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#dff5c4]">
          {ROLE_LABEL[membership.role]}
        </span>
        {access.canModerate && (
          <Link
            href={`/communities/${community.slug}/admin`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Manage
          </Link>
        )}
        {canLeave(membership) && (
          <ActionButton
            action={leaveCommunity}
            fields={fields}
            label="Leave"
            size="sm"
            confirmText={`Leave ${community.name}?`}
          />
        )}
      </div>
    );
  })();

  const backLink = (
    <Link href="/communities" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All communities
    </Link>
  );

  // Private community, viewer not an active member: name + how to get in, nothing else.
  if (!access.viewable) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {backLink}
        <div className="terminal-card p-6">
          <p className="terminal-label flex items-center gap-2">
            <Lock className="h-3 w-3" aria-hidden="true" /> Private community
          </p>
          <h1 className="mt-2 break-words text-2xl font-medium text-zinc-100">{community.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Private community — join by invite. Its description, members, and posts are visible to members only.
          </p>
          <div className="mt-5">{membershipControls}</div>
        </div>
      </div>
    );
  }

  const [detail, roster] = await Promise.all([communityDetail(community.id), communityRoster(community.id)]);
  if (!detail) notFound();
  const cursor = one(sp.cursor) ?? null;

  return (
    <div className="space-y-6">
      {backLink}

      <header className="terminal-card p-5 sm:p-6">
        <p className="terminal-label flex items-center gap-2">
          {detail.visibility === "PRIVATE" ? (
            <>
              <Lock className="h-3 w-3" aria-hidden="true" /> Private community
            </>
          ) : (
            <>
              <Globe className="h-3 w-3" aria-hidden="true" /> Public community
              {detail.requireApproval ? " · approval to join" : " · open to join"}
            </>
          )}
        </p>
        <h1 className="mt-2 break-words text-3xl font-medium tracking-[-0.04em] text-zinc-900">{detail.name}</h1>
        {detail.description ? (
          <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{detail.description}</p>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No description yet.</p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          {roster.length} active member{roster.length === 1 ? "" : "s"} · started by{" "}
          {detail.owner.profile?.displayName || detail.owner.name || "a member"}
        </p>
        <div className="mt-5">{membershipControls}</div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="min-w-0 space-y-6">
          {access.canPost ? (
            <PostComposer
              communityId={community.id}
              types={user.profile ? POST_TYPES : POST_TYPES.filter((t) => t !== "PERFORMANCE_UPDATE")}
              heading="Post to this community"
              intro="Visible to everyone who can see this community. Methods, evidence, and post-mortems."
            />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
              Members can post here. Join to take part in the discussion.
            </p>
          )}

          <section aria-labelledby="community-posts-heading">
            <h2 id="community-posts-heading" className="text-base font-medium text-zinc-800">
              Posts
            </h2>
            {cursor && (
              <p className="mt-1 text-xs text-zinc-500">
                Showing older posts ·{" "}
                <Link href={`/communities/${detail.slug}`} className="text-zinc-300 hover:text-white">
                  Back to newest
                </Link>
              </p>
            )}
            <div className="mt-3">
              <PostFeed
                viewerId={user.id}
                communityId={community.id}
                cursor={cursor}
                moreHref={`/communities/${detail.slug}`}
                emptyText="No posts in this community yet."
              />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="terminal-card p-5" aria-labelledby="rules-heading">
            <h2 id="rules-heading" className="text-sm font-medium text-zinc-800">
              Rules
            </h2>
            {detail.rules ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{detail.rules}</p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No community-specific rules yet.</p>
            )}
            <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] leading-5 text-zinc-500">{COMMUNITY_GUARDRAIL}</p>
          </section>

          <section className="terminal-card p-5" aria-labelledby="roster-heading">
            <h2 id="roster-heading" className="text-sm font-medium text-zinc-800">
              Members <span className="font-mono text-xs text-zinc-500">{roster.length}</span>
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">Record source and coverage only — never returns or scores.</p>
            <ul className="mt-3 divide-y divide-zinc-800">
              {roster.map((m) => (
                <li key={m.memberId} className="min-w-0 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {m.slug ? (
                      <Link href={`/p/${m.slug}`} className="min-w-0 truncate text-sm text-zinc-200 hover:text-[#baf277]">
                        {m.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate text-sm text-zinc-200">{m.name}</span>
                    )}
                    {m.role !== "MEMBER" && (
                      <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}
                    {m.userRole === "CLIENT" && (
                      <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                        Client
                      </span>
                    )}
                  </div>
                  {m.userRole !== "CLIENT" && (
                    <div className="mt-0.5">
                      <RecordBadge record={m.record} slug={m.record?.slug} compact />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
