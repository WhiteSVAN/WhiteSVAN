import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { ClientIdentity, InquiryStatusBadge, When, topicLabel, utcTitle, whenLabel } from "@/components/inquiries/ui";
import { RespondButtons } from "@/components/inquiries/respond-buttons";
import { safeInternalHref } from "@/lib/inquiries";
import { ActivityList, type ActivityItem } from "./activity-list";
import { markAllNotificationsRead } from "./actions";

export const metadata: Metadata = { title: "Inbox — TrustSVAN" };

type Tab = "activity" | "conversations";

function snippet(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "conversations" ? "conversations" : "activity";
  const isTrader = user.role === "TRADER" && Boolean(user.profile);

  const [unread, pendingCount] = await Promise.all([
    prisma.appNotification.count({ where: { userId: user.id, readAt: null } }),
    isTrader && user.profile
      ? prisma.inquiry.count({ where: { profileId: user.profile.id, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "activity", label: "Activity", count: unread },
    { key: "conversations", label: "Conversations", count: pendingCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="terminal-label">Inbox / private</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-100">Inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          {isTrader
            ? "Activity on your record and conversation requests from clients. Messaging opens only for requests you accept."
            : "Activity and the conversation requests you've sent. Messaging opens once a trader accepts."}
        </p>
      </div>

      <nav aria-label="Inbox sections" className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === "activity" ? "/inbox" : "/inbox?tab=conversations"}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-[#57733a] bg-[#1a2418] text-[#dff5c4]"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="rounded-full bg-[#baf277] px-1.5 py-0.5 font-mono text-[9px] text-[#17200e]">
                  {t.count > 99 ? "99+" : t.count}
                  <span className="sr-only">{t.key === "activity" ? " unread" : " pending"}</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "activity" ? (
        <ActivitySection userId={user.id} unread={unread} />
      ) : isTrader && user.profile ? (
        <TraderConversations profileId={user.profile.id} />
      ) : (
        <ClientConversations userId={user.id} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

async function ActivitySection({ userId, unread }: { userId: string; unread: number }) {
  const renderedAt = new Date();
  const rows = await prisma.appNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, title: true, href: true, readAt: true, createdAt: true },
  });
  const items: ActivityItem[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    href: safeInternalHref(n.href),
    unread: n.readAt === null,
    when: whenLabel(n.createdAt, renderedAt),
    whenIso: n.createdAt.toISOString(),
    whenTitle: utcTitle(n.createdAt),
  }));

  return (
    <section aria-labelledby="activity-heading" className="terminal-card p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="activity-heading" className="text-base font-medium text-zinc-100">
          Activity
        </h2>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-400 hover:text-white"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-sm text-zinc-500">
          Nothing yet. Follows, comments, conversation requests and replies will show up here.
        </p>
      ) : (
        <ActivityList items={items} renderedAt={renderedAt.toISOString()} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const SECTION_LIMIT = 100;

const lastMessageSelect = {
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { body: true, createdAt: true },
};

async function TraderConversations({ profileId }: { profileId: string }) {
  // One query per section so a long closed history can never push pending
  // requests out of a shared row cap.
  const select = {
    id: true,
    status: true,
    topic: true,
    message: true,
    createdAt: true,
    respondedAt: true,
    client: {
      select: { name: true, clientProfile: { select: { organization: true, clientType: true } } },
    },
    messages: lastMessageSelect,
    _count: { select: { messages: true } },
  } as const;
  const [profile, requests, activeRows, closed] = await Promise.all([
    prisma.traderProfile.findUnique({ where: { id: profileId }, select: { acceptInquiries: true } }),
    prisma.inquiry.findMany({
      where: { profileId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
      select,
    }),
    prisma.inquiry.findMany({
      where: { profileId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
      select,
    }),
    prisma.inquiry.findMany({
      where: { profileId, status: { in: ["DECLINED", "IGNORED"] } },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
      select,
    }),
  ]);
  const active = activeRows.sort((a, b) => lastActivity(b).getTime() - lastActivity(a).getTime());

  return (
    <div className="space-y-6">
      {profile && !profile.acceptInquiries && (
        <p className="rounded-md border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-400">
          You&apos;re not accepting new conversation requests.{" "}
          <Link href="/settings" className="text-[#baf277] underline-offset-2 hover:underline">
            Change this in Settings
          </Link>
          . Existing requests below can still be answered.
        </p>
      )}

      <section aria-labelledby="requests-heading" className="terminal-card p-4 sm:p-6">
        <SectionHeading id="requests-heading" title="Requests" count={requests.length} />
        {requests.length === 0 ? (
          <Empty>No pending requests.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {requests.map((r) => {
              const name = r.client.name?.trim() || "Unnamed client";
              return (
                <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <ClientIdentity
                      name={r.client.name}
                      organization={r.client.clientProfile?.organization}
                      clientType={r.client.clientProfile?.clientType}
                    />
                    <When date={r.createdAt} />
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#a5b497]">
                    Topic · {topicLabel(r.topic)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{r.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <RespondButtons inquiryId={r.id} status={r.status} clientName={name} />
                    <Link href={`/inbox/${r.id}`} className="text-xs text-zinc-400 hover:text-white">
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-heading" className="terminal-card p-4 sm:p-6">
        <SectionHeading id="active-heading" title="Active" count={active.length} />
        {active.length === 0 ? (
          <Empty>No active conversations. Accepting a request opens a private thread with that client.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {active.map((r) => (
              <ThreadRow
                key={r.id}
                id={r.id}
                who={
                  <ClientIdentity
                    name={r.client.name}
                    organization={r.client.clientProfile?.organization}
                    clientType={r.client.clientProfile?.clientType}
                  />
                }
                topic={r.topic}
                preview={r.messages[0]?.body ?? r.message}
                count={r._count.messages}
                at={lastActivity(r)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="closed-heading" className="terminal-card p-4 sm:p-6">
        <SectionHeading id="closed-heading" title="Closed" count={closed.length} />
        {closed.length === 0 ? (
          <Empty>Declined and ignored requests are kept here.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {closed.map((r) => {
              const name = r.client.name?.trim() || "Unnamed client";
              return (
                <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <ClientIdentity
                      name={r.client.name}
                      organization={r.client.clientProfile?.organization}
                      clientType={r.client.clientProfile?.clientType}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      {topicLabel(r.topic)} · received <When date={r.createdAt} />
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <InquiryStatusBadge status={r.status} perspective="trader" />
                    <RespondButtons inquiryId={r.id} status={r.status} clientName={name} size="sm" />
                    <Link href={`/inbox/${r.id}`} className="text-xs text-zinc-400 hover:text-white">
                      View
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

async function ClientConversations({ userId }: { userId: string }) {
  const rows = await prisma.inquiry.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      topic: true,
      message: true,
      createdAt: true,
      respondedAt: true,
      profile: { select: { displayName: true, slug: true, isPublic: true } },
      messages: lastMessageSelect,
      _count: { select: { messages: true } },
    },
  });

  return (
    <section aria-labelledby="sent-heading" className="terminal-card p-4 sm:p-6">
      <SectionHeading id="sent-heading" title="Sent requests" count={rows.length} />
      {rows.length === 0 ? (
        <Empty>
          You haven&apos;t requested any conversations yet.{" "}
          <Link href="/explore" className="text-[#baf277] underline-offset-2 hover:underline">
            Browse traders
          </Link>{" "}
          and use &ldquo;Request a conversation&rdquo; on a profile that&apos;s accepting requests.
        </Empty>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">
                  {r.profile.isPublic ? (
                    <Link href={`/p/${r.profile.slug}`} className="hover:text-white hover:underline">
                      {r.profile.displayName}
                    </Link>
                  ) : (
                    r.profile.displayName
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {topicLabel(r.topic)} · sent <When date={r.createdAt} />
                  {r.status === "ACCEPTED" && r._count.messages > 0 && (
                    <> · {r._count.messages} message{r._count.messages === 1 ? "" : "s"}</>
                  )}
                </p>
                {r.status === "ACCEPTED" && r.messages[0] && (
                  <p className="mt-1 truncate text-sm text-zinc-400">{snippet(r.messages[0].body)}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <InquiryStatusBadge status={r.status} perspective="client" />
                {r.status === "ACCEPTED" ? (
                  <Link
                    href={`/inbox/${r.id}`}
                    className="inline-flex min-h-8 items-center rounded-md border border-[#baf277] bg-[#baf277] px-3 py-1 text-xs font-medium text-[#17200e] transition hover:bg-[#cdf995]"
                  >
                    Open conversation
                  </Link>
                ) : (
                  <Link href={`/inbox/${r.id}`} className="text-xs text-zinc-400 hover:text-white">
                    View request
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function lastActivity(r: { createdAt: Date; respondedAt: Date | null; messages: { createdAt: Date }[] }): Date {
  return r.messages[0]?.createdAt ?? r.respondedAt ?? r.createdAt;
}

function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-2 text-base font-medium text-zinc-100">
      {title}
      <span className="font-mono text-[10px] text-zinc-500">{count}</span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-zinc-500">{children}</p>;
}

function ThreadRow({
  id,
  who,
  topic,
  preview,
  count,
  at,
}: {
  id: string;
  who: React.ReactNode;
  topic: string;
  preview: string;
  count: number;
  at: Date;
}) {
  return (
    <li>
      <Link
        href={`/inbox/${id}`}
        className="flex flex-col gap-1 rounded-md px-2 py-3 transition hover:bg-zinc-800 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <span className="min-w-0 flex-1">
          {who}
          <span className="mt-1 block truncate text-sm text-zinc-400">{snippet(preview)}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-zinc-500 sm:flex-col sm:items-end sm:gap-1">
          <span>{topicLabel(topic)}</span>
          <span>
            {count} message{count === 1 ? "" : "s"} · <When date={at} />
          </span>
        </span>
      </Link>
    </li>
  );
}
