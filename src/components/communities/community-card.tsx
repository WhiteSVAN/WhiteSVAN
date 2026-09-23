/** Community summary card: name, description, factual member counts. Never ranks by performance. */
import Link from "next/link";
import { Globe, Lock, ShieldCheck, Users } from "lucide-react";
import { ROLE_LABEL, type CommunityRoleKey } from "@/lib/communities";

export interface CommunityCardData {
  slug: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  requireApproval: boolean;
  activeMembers: number;
  withRecord: number;
  role?: CommunityRoleKey;
  status?: "PENDING" | "ACTIVE" | "REMOVED";
}

export function CommunityCard({ community }: { community: CommunityCardData }) {
  const privateRoom = community.visibility === "PRIVATE";
  return (
    <article className="terminal-card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/communities/${community.slug}`}
          className="min-w-0 break-words text-base font-medium text-zinc-100 hover:text-[#baf277]"
        >
          {community.name}
        </Link>
        <span className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
          {privateRoom ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
          {privateRoom ? "Private" : community.requireApproval ? "Public · approval" : "Public · open"}
        </span>
      </div>
      {community.status === "PENDING" ? (
        <p className="mt-2 text-xs text-zinc-400">Join request pending approval.</p>
      ) : community.role ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#c5d9ad]">{ROLE_LABEL[community.role]}</p>
      ) : null}
      {community.description && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-400">{community.description}</p>
      )}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {community.activeMembers} member{community.activeMembers === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {community.withRecord} with a published record
        </span>
      </div>
    </article>
  );
}
