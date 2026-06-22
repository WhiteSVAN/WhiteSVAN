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
      <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-16 text-center">
        <p className="text-sm text-slate-500">This profile isn&apos;t available for diligence.</p>
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
    <div className="min-h-full bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-base font-semibold tracking-[0.18em] text-slate-100">
            <SvanLogo />
          </Link>
          <Link
            href={`/p/${slug}`}
            className="text-sm font-medium text-cyan-300 hover:text-cyan-100"
          >
            ← Full profile
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Allocator diligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {profile.displayName}
          </h1>
          {profile.headline && (
            <p className="mt-1 text-sm font-medium text-slate-300">{profile.headline}</p>
          )}
        </div>

        {brief ? (
          <DiligenceBriefView brief={brief} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-sm text-slate-500">
            No published record yet — there&apos;s nothing to run diligence on.
          </div>
        )}

        <footer className="border-t border-slate-800 pt-6 text-xs leading-relaxed text-slate-400">
          {DISCLAIMER}
        </footer>
      </main>
    </div>
  );
}
