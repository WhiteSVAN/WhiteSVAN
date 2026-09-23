/**
 * Trader dashboard card: pending conversation requests with quick responses
 * (CONTRACT: keep name + props). `userId` must be the signed-in trader — the
 * dashboard passes the session user; the respond action re-checks ownership.
 */
import Link from "next/link";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { ClientIdentity, When, topicLabel } from "./ui";
import { RespondButtons } from "./respond-buttons";

export async function InquiriesCard(props: { userId: string }) {
  const profile = await prisma.traderProfile.findUnique({
    where: { userId: props.userId },
    select: { id: true, acceptInquiries: true },
  });
  if (!profile) return null;

  const [pendingCount, pending, activeCount] = await Promise.all([
    prisma.inquiry.count({ where: { profileId: profile.id, status: "PENDING" } }),
    prisma.inquiry.findMany({
      where: { profileId: profile.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        topic: true,
        message: true,
        createdAt: true,
        client: {
          select: { name: true, clientProfile: { select: { organization: true, clientType: true } } },
        },
      },
    }),
    prisma.inquiry.count({ where: { profileId: profile.id, status: "ACCEPTED" } }),
  ]);

  return (
    <section aria-labelledby="inquiries-card-heading" className="terminal-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="terminal-label">Professional inquiries</p>
          <h2 id="inquiries-card-heading" className="mt-1 flex flex-wrap items-center gap-2 text-base font-medium text-zinc-100">
            <Inbox className="h-4 w-4 text-[#baf277]" aria-hidden="true" />
            Conversation requests
            {pendingCount > 0 && (
              <span className="rounded-full bg-[#baf277] px-1.5 py-0.5 font-mono text-[10px] text-[#17200e]">
                {pendingCount} pending
              </span>
            )}
          </h2>
        </div>
        <Link
          href="/inbox?tab=conversations"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-400 hover:text-white"
        >
          Open inbox{activeCount > 0 ? ` · ${activeCount} active` : ""}
        </Link>
      </div>

      {!profile.acceptInquiries && (
        <p className="mt-3 text-sm text-zinc-400">
          You&apos;re not accepting conversation requests.{" "}
          <Link href="/settings" className="text-[#baf277] underline-offset-2 hover:underline">
            Turn them on in Settings
          </Link>{" "}
          to let clients reach you from your public profile.
        </p>
      )}

      {pending.length === 0 ? (
        profile.acceptInquiries && (
          <p className="mt-3 text-sm text-zinc-500">No pending requests. New ones will show up here and in your inbox.</p>
        )
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800">
          {pending.map((inq) => {
            const name = inq.client.name?.trim() || "Unnamed client";
            return (
              <li key={inq.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <ClientIdentity
                    name={inq.client.name}
                    organization={inq.client.clientProfile?.organization}
                    clientType={inq.client.clientProfile?.clientType}
                  />
                  <span className="text-xs text-zinc-500">
                    {topicLabel(inq.topic)} · <When date={inq.createdAt} />
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 break-words text-sm text-zinc-300">{inq.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <RespondButtons inquiryId={inq.id} status={inq.status} clientName={name} size="sm" />
                  <Link href={`/inbox/${inq.id}`} className="text-xs text-zinc-400 hover:text-white">
                    View full request
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pendingCount > pending.length && (
        <p className="mt-3 text-xs text-zinc-500">
          <Link href="/inbox?tab=conversations" className="hover:text-white">
            {pendingCount - pending.length} more pending in your inbox →
          </Link>
        </p>
      )}
    </section>
  );
}
