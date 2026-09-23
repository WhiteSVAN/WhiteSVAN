/**
 * "Request a conversation" block for a public trader profile. Resolves the
 * viewer's role / existing inquiry itself (CONTRACT: keep name + props).
 *
 * Nothing for the owner; a muted line when the trader isn't accepting or the
 * viewer is another trader; sign-in links when signed out; for clients, the
 * state of their latest request plus the form when a new one is allowed.
 */
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { OPEN_STATUSES, canRequestAgain, requestAgainAt, type InquiryStatusKey } from "@/lib/inquiries";
import { InquiryStatusBadge, When, topicLabel } from "./ui";
import { RequestForm } from "./request-form";

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-500">{children}</p>;
}

const STATE_COPY: Record<InquiryStatusKey, (name: string) => string> = {
  PENDING: (name) => `Waiting for ${name} to respond.`,
  ACCEPTED: (name) => `${name} accepted your request.`,
  DECLINED: (name) => `${name} declined this request.`,
  IGNORED: (name) => `${name} hasn't responded to this request.`,
};

export async function RequestConversation(props: { profileId: string; viewerId: string | null }) {
  const { profileId, viewerId } = props;
  const profile = await prisma.traderProfile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, displayName: true, isPublic: true, acceptInquiries: true },
  });
  if (!profile || !profile.isPublic || profile.userId === viewerId) return null;

  const notAccepting = <Muted>Not accepting conversation requests right now.</Muted>;

  if (!viewerId) {
    if (!profile.acceptInquiries) return notAccepting;
    return (
      <p className="text-xs text-zinc-400">
        <Link href="/login" className="text-[#baf277] underline-offset-2 hover:underline">
          Sign in as a client
        </Link>{" "}
        to request a conversation. New here?{" "}
        <Link href="/signup?as=client" className="text-[#baf277] underline-offset-2 hover:underline">
          Create a client account
        </Link>
        .
      </p>
    );
  }

  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { role: true, clientProfile: { select: { id: true } } },
  });
  if (!viewer) return null;

  if (viewer.role === "TRADER") {
    return profile.acceptInquiries ? <Muted>Conversation requests are sent from client accounts.</Muted> : notAccepting;
  }

  if (viewer.role !== "CLIENT" || !viewer.clientProfile) {
    if (!profile.acceptInquiries) return notAccepting;
    return (
      <p className="text-xs text-zinc-400">
        <Link href="/onboarding" className="text-[#baf277] underline-offset-2 hover:underline">
          Finish your client profile
        </Link>{" "}
        to request a conversation.
      </p>
    );
  }

  const history = await prisma.inquiry.findMany({
    where: { clientId: viewerId, profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, status: true, topic: true, createdAt: true, respondedAt: true },
  });
  const latest = history[0] ?? null;
  const open = history.find((i) => OPEN_STATUSES.includes(i.status)) ?? null;
  const shown = open ?? latest;
  const allowed = profile.acceptInquiries && !open && canRequestAgain(latest, new Date());

  if (!shown && !profile.acceptInquiries) return notAccepting;

  const nextAt = !open && latest ? requestAgainAt(latest) : null;

  return (
    <section aria-labelledby={`request-${profile.id}`} className="terminal-card p-5">
      <p className="terminal-label">Professional inquiry</p>
      <h2 id={`request-${profile.id}`} className="mt-1 text-base font-medium text-zinc-100">
        {shown ? `Your conversation with ${profile.displayName}` : `Request a conversation with ${profile.displayName}`}
      </h2>

      {shown && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <InquiryStatusBadge status={shown.status} perspective="client" />
          <span className="text-zinc-300">{STATE_COPY[shown.status](profile.displayName)}</span>
          <span className="text-xs text-zinc-500">
            {topicLabel(shown.topic)} · sent <When date={shown.createdAt} />
          </span>
          {shown.status === "ACCEPTED" && (
            <Link
              href={`/inbox/${shown.id}`}
              className="inline-flex min-h-9 items-center rounded-md border border-[#baf277] bg-[#baf277] px-3 py-1.5 text-xs font-medium text-[#17200e] transition hover:bg-[#cdf995]"
            >
              Open conversation
            </Link>
          )}
        </div>
      )}

      {!shown && (
        <p className="mt-2 text-sm text-zinc-400">
          Ask about their record, research, or a role. {profile.displayName} decides whether to accept; messaging
          opens only after they do.
        </p>
      )}

      {allowed ? (
        <RequestForm profileId={profile.id} traderName={profile.displayName} />
      ) : (
        !open &&
        latest &&
        profile.acceptInquiries &&
        nextAt && (
          <p className="mt-3 text-xs text-zinc-500">
            You can send a new request after {format(nextAt, "MMM d, yyyy")}.
          </p>
        )
      )}

      {!allowed && !profile.acceptInquiries && shown && shown.status !== "ACCEPTED" && (
        <p className="mt-3 text-xs text-zinc-500">Not accepting conversation requests right now.</p>
      )}
    </section>
  );
}
