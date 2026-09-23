import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { buildDiligenceBrief } from "@/lib/diligence";
import { toRecordContext } from "@/lib/record-context";
import { profileHref, provenanceLine } from "@/lib/profile-page";
import { DiligenceBriefView } from "@/components/portal/diligence-brief";
import { HiddenSection } from "@/components/portal/hidden-section";
import { ProvenanceLine } from "@/components/portal/provenance-line";
import { getLatestVersion, getVersionSnapshot, getViewableProfile } from "../data";

const DISCLAIMER =
  "Diligence summarizes this operator's published past performance for evaluation. TrustSVAN does not manage money, execute trades, or provide investment advice, and nothing here is an allocation recommendation. Past performance does not guarantee future results.";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getViewableProfile(slug);
  return {
    title: view?.profile.isPublic ? `Diligence · ${view.profile.displayName} — TrustSVAN` : "TrustSVAN",
    robots: { index: false, follow: false },
  };
}

export default async function DiligencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getViewableProfile(slug);

  if (!view) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-16 text-center">
        <p className="text-sm text-zinc-400">This profile isn&apos;t available for diligence.</p>
      </div>
    );
  }

  const { profile, hidden, isOwner } = view;
  const performanceHidden = hidden.has("performance");
  const latest = performanceHidden ? null : await getLatestVersion(profile.id);
  const row = latest ? await getVersionSnapshot(profile.id, latest.versionNumber) : null;
  const trust = row ? (publishedTrustFromMetrics(row.metrics)?.trust ?? null) : null;
  const brief = trust ? buildDiligenceBrief(trust) : null;
  const record = row ? toRecordContext(row) : null;

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-4xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2">
            <i className="terminal-dot" /> Diligence terminal
          </span>
          <span className="truncate">Past performance / non-advisory</span>
        </div>
      </div>
      <nav className="border-b border-zinc-800 bg-zinc-950/90" aria-label="Site">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-xl font-semibold text-zinc-100" aria-label="TrustSVAN home">
            <SvanLogo />
          </Link>
          <Link href={profileHref(profile.slug)} className="text-sm font-medium text-zinc-200 hover:text-zinc-100">
            ← Full profile
          </Link>
        </div>
      </nav>

      {isOwner && !profile.isPublic && (
        <div className="border-b border-zinc-600 bg-zinc-800/70" role="status">
          <p className="mx-auto flex max-w-4xl items-center gap-1.5 px-4 py-2 text-xs font-medium text-white">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Private — only you can see this.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div>
          <p className="terminal-label">Allocator diligence</p>
          <h1 className="mt-2 break-words text-3xl font-medium tracking-[-0.045em] text-white sm:text-4xl">
            {profile.displayName}
          </h1>
          {profile.headline && <p className="mt-1 text-sm font-medium text-zinc-300">{profile.headline}</p>}
        </div>

        {performanceHidden ? (
          <HiddenSection title="Diligence brief" isOwner={isOwner} />
        ) : brief && record ? (
          <div className="space-y-4">
            <ProvenanceLine
              text={provenanceLine(record)}
            />
            <DiligenceBriefView brief={brief} />
          </div>
        ) : (
          <div className="terminal-card border-dashed p-10 text-center text-sm text-zinc-400">
            No published record yet — there&apos;s nothing to run diligence on.
          </div>
        )}

        <footer className="border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-400">{DISCLAIMER}</footer>
      </main>
    </div>
  );
}
