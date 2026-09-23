import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { COMMUNITY_GUARDRAIL } from "@/lib/communities";
import { CommunityCard } from "@/components/communities/community-card";
import { discoverCommunities, myCommunities } from "./queries";
import { CreateCommunityForm } from "./create-community-form";

export const metadata: Metadata = { title: "Communities - TrustSVAN" };

export default async function CommunitiesPage() {
  const user = await requireOnboardedUser();
  const [mine, discover] = await Promise.all([myCommunities(user.id), discoverCommunities()]);
  const mineIds = new Set(mine.map((c) => c.id));
  const others = discover.filter((c) => !mineIds.has(c.id));

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="terminal-label">Research rooms / evidence-first</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Communities</h1>
        <p className="mt-2 text-sm text-zinc-500">{COMMUNITY_GUARDRAIL}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="mine-heading">
            <h2 id="mine-heading" className="text-base font-medium text-zinc-800">
              Your communities <span className="font-mono text-xs text-zinc-500">{mine.length}</span>
            </h2>
            {mine.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                You haven&apos;t joined any communities yet. Join one below or start your own.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {mine.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="discover-heading">
            <h2 id="discover-heading" className="text-base font-medium text-zinc-800">
              Discover
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Public communities, newest first. Counts are factual: active members and members with a published record.
            </p>
            {others.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                No other public communities yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {others.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="terminal-card h-fit min-w-0 p-5 sm:p-6" aria-labelledby="create-heading">
          <h2 id="create-heading" className="text-base font-medium text-zinc-800">
            Start a community
          </h2>
          <p className="mt-1 text-sm text-zinc-500">You become its owner.</p>
          <div className="mt-4">
            <CreateCommunityForm />
          </div>
        </section>
      </div>
    </div>
  );
}
