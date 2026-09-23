import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserId } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { availableDecisions, canMessage, type InquiryStatusKey } from "@/lib/inquiries";
import { ClientIdentity, InquiryStatusBadge, When, topicLabel } from "@/components/inquiries/ui";
import { RespondButtons } from "@/components/inquiries/respond-buttons";
import { MessageForm } from "./message-form";
import { MarkThreadSeen } from "./mark-seen";

export const metadata: Metadata = { title: "Conversation — TrustSVAN" };

const MESSAGE_LIMIT = 300;

/**
 * One inquiry thread. Visible only to the client who sent it and the owner of
 * the profile it was sent to — everyone else gets a 404 (no existence leak).
 */
export default async function InquiryThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      topic: true,
      message: true,
      createdAt: true,
      respondedAt: true,
      clientId: true,
      client: {
        select: { name: true, clientProfile: { select: { organization: true, clientType: true } } },
      },
      profile: { select: { userId: true, displayName: true, slug: true, isPublic: true } },
    },
  });
  if (!inquiry) notFound();
  const isClient = inquiry.clientId === userId;
  const isTrader = inquiry.profile.userId === userId;
  if (!isClient && !isTrader) notFound();

  const href = `/inbox/${inquiry.id}`;
  const [recent, total, unreadHere] = await Promise.all([
    prisma.inquiryMessage.findMany({
      where: { inquiryId: inquiry.id },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_LIMIT,
      select: { id: true, body: true, createdAt: true, senderId: true },
    }),
    prisma.inquiryMessage.count({ where: { inquiryId: inquiry.id } }),
    prisma.appNotification.count({ where: { userId, href, readAt: null } }),
  ]);
  const messages = recent.reverse();

  const clientName = inquiry.client.name?.trim() || "Unnamed client";
  const traderName = inquiry.profile.displayName;
  const counterpart = isTrader ? clientName : traderName;
  const perspective = isTrader ? "trader" : "client";
  const nameFor = (senderId: string) =>
    senderId === userId ? "You" : senderId === inquiry.clientId ? clientName : traderName;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {unreadHere > 0 && <MarkThreadSeen href={href} before={new Date().toISOString()} />}

      <Link
        href="/inbox?tab=conversations"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Inbox
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="terminal-label">Conversation / private</p>
          <h1 className="mt-2 break-words text-2xl font-medium tracking-[-0.03em] text-zinc-100">
            {isClient && inquiry.profile.isPublic ? (
              <Link href={`/p/${inquiry.profile.slug}`} className="hover:underline">
                {traderName}
              </Link>
            ) : (
              counterpart
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{topicLabel(inquiry.topic)}</p>
        </div>
        <InquiryStatusBadge status={inquiry.status} perspective={perspective} />
      </header>

      <section aria-labelledby="original-request" className="terminal-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="original-request" className="terminal-label">
            Original request
          </h2>
          <When date={inquiry.createdAt} />
        </div>
        <div className="mt-3">
          {isTrader ? (
            <ClientIdentity
              name={inquiry.client.name}
              organization={inquiry.client.clientProfile?.organization}
              clientType={inquiry.client.clientProfile?.clientType}
            />
          ) : (
            <p className="text-xs text-zinc-400">You → {traderName}</p>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{inquiry.message}</p>
        {isTrader && availableDecisions(inquiry.status).length > 0 && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <RespondButtons inquiryId={inquiry.id} status={inquiry.status} clientName={clientName} />
          </div>
        )}
      </section>

      {messages.length > 0 && (
        <section aria-label="Messages" className="space-y-3">
          {total > messages.length && (
            <p className="text-center font-mono text-[10px] text-zinc-500">
              Showing the latest {messages.length} of {total} messages
            </p>
          )}
          <ol className="space-y-3">
            {messages.map((m) => {
              const mine = m.senderId === userId;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <article
                    className={`max-w-[90%] rounded-lg border px-4 py-3 sm:max-w-[80%] ${
                      mine ? "border-[#57733a] bg-[#1a2418]" : "border-zinc-800 bg-zinc-950/70"
                    }`}
                  >
                    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs font-medium text-zinc-200">{nameFor(m.senderId)}</span>
                      <When date={m.createdAt} />
                    </header>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100">{m.body}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="terminal-card p-4 sm:p-5">
        {canMessage(inquiry.status) ? (
          <MessageForm inquiryId={inquiry.id} recipientName={counterpart} />
        ) : (
          <p className="text-sm text-zinc-400">{lockedCopy(inquiry.status, isTrader, clientName, traderName)}</p>
        )}
      </section>

      <p className="text-xs leading-5 text-zinc-500">
        TrustSVAN conversations are for research and diligence. Nothing here is investment advice, a signal, or an
        offer to manage money. Past performance does not guarantee future results.
      </p>
    </div>
  );
}

function lockedCopy(status: InquiryStatusKey, isTrader: boolean, clientName: string, traderName: string): string {
  switch (status) {
    case "PENDING":
      return isTrader
        ? `Accept to open a private thread with ${clientName}. Declining notifies them; ignoring doesn't.`
        : `Messaging opens once ${traderName} accepts your request.`;
    case "DECLINED":
      return isTrader
        ? "You declined this request. Messaging is closed."
        : `${traderName} declined this request. Messaging is closed.`;
    case "IGNORED":
      return isTrader
        ? "You ignored this request. You can still accept it above."
        : `${traderName} hasn't responded to this request.`;
    case "ACCEPTED":
      return "";
  }
}
