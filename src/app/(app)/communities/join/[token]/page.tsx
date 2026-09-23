import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { COMMUNITY_GUARDRAIL, inviteIsUsable } from "@/lib/communities";
import { ActionButton } from "@/components/communities/action-button";
import { acceptInvite } from "../../actions";

export const metadata: Metadata = { title: "Community invite - TrustSVAN", robots: { index: false, follow: false } };

/**
 * Invite landing. Joining is a POST (the button), never a side effect of
 * opening the link — so link previews and prefetches can't consume invites.
 */
export default async function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireOnboardedUser();
  const invite = await prisma.communityInvite.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      community: { select: { id: true, slug: true, name: true, visibility: true } },
    },
  });

  if (!invite || !inviteIsUsable(invite)) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="terminal-card p-6">
          <h1 className="text-lg font-medium text-zinc-100">Invite unavailable</h1>
          <p className="mt-1 text-sm text-zinc-500">
            This invite link has expired or was revoked. Ask a community admin for a new one.
          </p>
          <Link href="/communities" className="mt-4 inline-block text-sm text-zinc-300 hover:text-white">
            Browse communities
          </Link>
        </div>
      </div>
    );
  }

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: invite.community.id, userId: user.id } },
    select: { status: true },
  });
  const { community } = invite;

  return (
    <div className="mx-auto max-w-xl">
      <div className="terminal-card p-6">
        <p className="terminal-label flex items-center gap-2">
          {community.visibility === "PRIVATE" ? (
            <Lock className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Globe className="h-3 w-3" aria-hidden="true" />
          )}
          Community invite
        </p>
        <h1 className="mt-2 break-words text-2xl font-medium text-zinc-100">{community.name}</h1>
        {membership?.status === "ACTIVE" ? (
          <>
            <p className="mt-2 text-sm text-zinc-400">You&apos;re already a member.</p>
            <Link
              href={`/communities/${community.slug}`}
              className="mt-4 inline-flex min-h-10 items-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 hover:bg-white"
            >
              Open community
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-400">
              You&apos;ve been invited to join. Invites skip the approval queue.
            </p>
            <p className="mt-3 text-xs leading-5 text-zinc-500">{COMMUNITY_GUARDRAIL}</p>
            <div className="mt-5">
              <ActionButton action={acceptInvite} fields={{ token }} label="Join community" pendingLabel="Joining…" variant="primary" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
