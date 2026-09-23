import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { communityAccessBySlug } from "@/lib/post-queries";
import {
  COMMUNITY_LIMITS,
  INVITE_TTL_DAYS,
  ROLE_LABEL,
  canChangeRole,
  canRemove,
  type CommunityRoleKey,
} from "@/lib/communities";
import { RecordBadge } from "@/components/record-badge";
import { ActionButton } from "@/components/communities/action-button";
import { AdminNoteForm } from "@/components/communities/admin-note-form";
import { CopyLink } from "@/components/communities/copy-link";
import { communityAdminData, communityDetail } from "../../queries";
import {
  approveMember,
  createInvite,
  rejectMember,
  removeFlaggedPost,
  removeMember,
  resolveFlags,
  revokeInvite,
  saveAdminNote,
  setMemberRole,
} from "./actions";
import { CommunitySettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Manage community - TrustSVAN" };

function ago(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

const chip = "rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400";

export default async function CommunityAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireOnboardedUser();
  const access = await communityAccessBySlug(slug, user.id);
  // Owners/admins only; everyone else gets a plain 404 (no hint the admin page exists).
  if (!access || !access.canModerate || !access.membership) notFound();

  const actorRole = access.membership.role as CommunityRoleKey;
  const communityId = access.community.id;
  const [detail, data] = await Promise.all([communityDetail(communityId), communityAdminData(communityId)]);
  if (!detail) notFound();
  const base = { communityId };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/communities/${detail.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {detail.name}
      </Link>
      <div>
        <p className="terminal-label">Community admin / {ROLE_LABEL[actorRole]}</p>
        <h1 className="mt-2 break-words text-3xl font-medium tracking-[-0.04em] text-zinc-900">Manage {detail.name}</h1>
      </div>

      {/* Join requests */}
      <section className="terminal-card p-5 sm:p-6" aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-base font-medium text-zinc-800">
          Join requests <span className="font-mono text-xs text-zinc-500">{data.pending.length}</span>
        </h2>
        {data.pending.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No pending requests.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800">
            {data.pending.map((p) => (
              <li key={p.memberId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.slug ? (
                      <Link href={`/p/${p.slug}`} className="text-sm text-zinc-200 hover:text-[#baf277]">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-200">{p.name}</span>
                    )}
                    {p.userRole === "CLIENT" && <span className={chip}>Client</span>}
                    <span className="font-mono text-[10px] text-zinc-500">requested {ago(p.requestedAt)}</span>
                  </div>
                  {p.userRole !== "CLIENT" && (
                    <div className="mt-0.5">
                      <RecordBadge record={p.record} slug={p.record?.slug} compact />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={approveMember} fields={{ ...base, memberId: p.memberId }} label="Approve" size="sm" variant="primary" />
                  <ActionButton action={rejectMember} fields={{ ...base, memberId: p.memberId }} label="Decline" size="sm" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Members */}
      <section className="terminal-card p-5 sm:p-6" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-base font-medium text-zinc-800">
          Members <span className="font-mono text-xs text-zinc-500">{data.members.length}</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Admin notes are visible to owners and admins only. Removed members can return only with an invite link.
        </p>
        <ul className="mt-3 divide-y divide-zinc-800">
          {data.members.map((m) => {
            const self = m.userId === user.id;
            const removable = !self && canRemove(actorRole, m.role as CommunityRoleKey);
            const roleChangeable = !self && canChangeRole(actorRole, m.role as CommunityRoleKey);
            return (
              <li key={m.memberId} className="min-w-0 space-y-2 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.slug ? (
                        <Link href={`/p/${m.slug}`} className="text-sm text-zinc-200 hover:text-[#baf277]">
                          {m.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-zinc-200">{m.name}</span>
                      )}
                      <span className={chip}>{ROLE_LABEL[m.role as CommunityRoleKey]}</span>
                      {m.userRole === "CLIENT" && <span className={chip}>Client</span>}
                      {self && <span className="text-[10px] text-zinc-500">(you)</span>}
                    </div>
                    {m.userRole !== "CLIENT" && (
                      <div className="mt-0.5">
                        <RecordBadge record={m.record} slug={m.record?.slug} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roleChangeable &&
                      (m.role === "ADMIN" ? (
                        <ActionButton
                          action={setMemberRole}
                          fields={{ ...base, memberId: m.memberId, role: "MEMBER" }}
                          label="Make member"
                          size="sm"
                        />
                      ) : (
                        <ActionButton
                          action={setMemberRole}
                          fields={{ ...base, memberId: m.memberId, role: "ADMIN" }}
                          label="Make admin"
                          size="sm"
                        />
                      ))}
                    {removable && (
                      <ActionButton
                        action={removeMember}
                        fields={{ ...base, memberId: m.memberId }}
                        label="Remove"
                        size="sm"
                        variant="danger"
                        confirmText={`Remove ${m.name}? They can return only with an invite link.`}
                      />
                    )}
                  </div>
                </div>
                <AdminNoteForm
                  action={saveAdminNote}
                  communityId={communityId}
                  memberId={m.memberId}
                  note={m.adminNote ?? ""}
                  maxLength={COMMUNITY_LIMITS.adminNote}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Invites */}
      <section className="terminal-card p-5 sm:p-6" aria-labelledby="invites-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="invites-heading" className="text-base font-medium text-zinc-800">
            Invite links <span className="font-mono text-xs text-zinc-500">{data.invites.length}</span>
          </h2>
          <ActionButton action={createInvite} fields={base} label="New invite link" size="sm" variant="primary" />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Links expire after {INVITE_TTL_DAYS} days, skip approval, and let removed members back in. Share them privately.
        </p>
        {data.invites.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No active invite links.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CopyLink path={`/communities/join/${i.token}`} />
                  <p className="text-[11px] text-zinc-500">
                    By {i.invitedBy} · expires {ago(i.expiresAt)} · used {i.uses} time{i.uses === 1 ? "" : "s"}
                  </p>
                </div>
                <ActionButton
                  action={revokeInvite}
                  fields={{ ...base, inviteId: i.id }}
                  label="Revoke"
                  size="sm"
                  variant="danger"
                  confirmText="Revoke this invite link? It will stop working immediately."
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Flags */}
      <section className="terminal-card p-5 sm:p-6" aria-labelledby="flags-heading">
        <h2 id="flags-heading" className="text-base font-medium text-zinc-800">
          Flagged posts <span className="font-mono text-xs text-zinc-500">{data.flagged.length}</span>
        </h2>
        {data.flagged.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No open flags.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {data.flagged.map((p) => (
              <li key={p.id} className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/feed/${p.id}`} className="break-words text-sm font-medium text-zinc-200 hover:text-[#baf277]">
                    {p.title}
                  </Link>
                  <span className="font-mono text-[10px] text-zinc-500">
                    by {p.author} · {ago(p.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-zinc-400">{p.excerpt}</p>
                <ul className="mt-2 space-y-1">
                  {p.flags.map((f) => (
                    <li key={f.id} className="break-words text-[11px] text-zinc-300">
                      <span className="text-zinc-500">Flag · {ago(f.createdAt)} ·</span> {f.reason}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton action={resolveFlags} fields={{ ...base, postId: p.id }} label="Keep post · resolve" size="sm" />
                  <ActionButton
                    action={removeFlaggedPost}
                    fields={{ ...base, postId: p.id }}
                    label="Remove post"
                    size="sm"
                    variant="danger"
                    confirmText="Remove this post from the community?"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Settings */}
      <section className="terminal-card p-5 sm:p-6" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-base font-medium text-zinc-800">
          Settings
        </h2>
        <div className="mt-4">
          <CommunitySettingsForm
            communityId={communityId}
            description={detail.description ?? ""}
            rules={detail.rules ?? ""}
            visibility={detail.visibility}
            requireApproval={detail.requireApproval}
          />
        </div>
      </section>
    </div>
  );
}
