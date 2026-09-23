import type { Metadata } from "next";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { prisma } from "@/lib/db";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { buildDiligenceBrief } from "@/lib/diligence";
import { DiligenceBriefView } from "@/components/portal/diligence-brief";

const DISCLAIMER =
  "Diligence summarizes this operator's verified past performance for evaluation. TrustSVAN does not manage money, execute trades, or provide investment advice, and nothing here is an allocation recommendation. Past performance does not guarantee future results.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await prisma.traderProfile.findUnique({
    where: { slug },
    select: { displayName: true, isPublic: true },
  });
  return {
    title: profile?.isPublic ? `Diligence · ${profile.displayName} — TrustSVAN` : "TrustSVAN",
    robots: { index: false },
  };
}

export default async function DiligencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await prisma.traderProfile.findUnique({
    where: { slug },
    select: { id: true, displayName: true, headline: true, isPublic: true },
  });

  if (!profile || !profile.isPublic) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-16 text-center">
        <p className="text-sm text-zinc-500">This profile isn&apos;t available for diligence.</p>
      </div>
    );
  }

  const latestVersion = await prisma.profileVersion.findFirst({
    where: { profileId: profile.id },
    orderBy: { versionNumber: "desc" },
    select: { metrics: true },
  });
  const trust = latestVersion
    ? (publishedTrustFromMetrics(latestVersion.metrics)?.trust ?? null)
    : null;
  const brief = trust ? buildDiligenceBrief(trust) : null;

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-4xl items-center justify-between px-4"><span className="flex items-center gap-2"><i className="terminal-dot" /> Diligence terminal</span><span>Past performance / non-advisory</span></div>
      </div>
      <nav className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-semibold text-zinc-100">
            <SvanLogo />
          </Link>
          <Link
            href={`/p/${slug}`}
            className="text-sm font-medium text-zinc-200 hover:text-zinc-100"
          >
            ← Full profile
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div>
          <p className="terminal-label">
            Allocator diligence
          </p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.045em] text-zinc-900">
            {profile.displayName}
          </h1>
          {profile.headline && (
            <p className="mt-1 text-sm font-medium text-zinc-300">{profile.headline}</p>
          )}
        </div>

        {brief ? (
          <DiligenceBriefView brief={brief} />
        ) : (
          <div className="terminal-card border-dashed p-10 text-center text-sm text-zinc-500">
            No published record yet — there&apos;s nothing to run diligence on.
          </div>
        )}

        <footer className="border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-400">
          {DISCLAIMER}
        </footer>
      </main>
    </div>
  );
}
