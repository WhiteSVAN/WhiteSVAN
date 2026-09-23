import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { SiteFooter } from "@/components/site-footer";
import { OperatorDirectory, type DirectoryOperator } from "@/components/explore/operator-directory";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { publishedTrustFromMetrics } from "@/lib/published-profile";

export const metadata: Metadata = {
  title: "Explore operators — TrustSVAN",
  description: "Inspect published trading records by proof level, strategy, performance, and risk context.",
};

export default async function ExplorePage() {
  const session = await auth();
  const loggedIn = !!session?.user;
  const profiles = await prisma.traderProfile
    .findMany({
      where: { isPublic: true },
      select: {
        slug: true,
        displayName: true,
        strategy: true,
        instruments: true,
        openToWork: true,
        headline: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { metrics: true },
        },
      },
      orderBy: { displayName: "asc" },
    })
    .catch((error) => {
      console.error("Unable to load public profiles", error);
      return [];
    });

  const operators: DirectoryOperator[] = profiles.map((profile) => {
    const trust = publishedTrustFromMetrics(profile.versions[0]?.metrics)?.trust ?? null;
    return {
      slug: profile.slug,
      displayName: profile.displayName,
      strategy: profile.strategy,
      instruments: profile.instruments,
      headline: profile.headline,
      openToWork: profile.openToWork,
      proofLevel: trust?.proofLevel ?? null,
      returnPct: trust?.metrics.returnPct ?? null,
      maxDrawdownPct: trust?.metrics.maxDrawdownPct ?? null,
      transparencyScore: trust?.scores.transparency ?? null,
      severity: trust?.drawdownSeverity ?? null,
    };
  });

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-8">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> Published records</span>
          <span>Source-backed / operator controlled</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href={loggedIn ? "/dashboard" : "/"} className="text-xl font-semibold text-zinc-100"><SvanLogo /></Link>
          <div className="flex items-center gap-4 text-xs">
            <Link href={loggedIn ? "/dashboard" : "/"} className="hidden items-center gap-2 text-zinc-400 hover:text-zinc-100 sm:flex"><ArrowLeft className="h-3.5 w-3.5" /> {loggedIn ? "Workspace" : "Home"}</Link>
            <Link href={loggedIn ? "/network" : "/signup"} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-100 px-4 font-medium text-zinc-950 hover:bg-white">
              {loggedIn ? "Open network" : "Build your record"}<ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="terminal-grid border-b border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20">
            <p className="terminal-label flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-[#baf277]" /> Discovery, with context</p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.55fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-0.055em] sm:text-6xl">Inspect the record.<br /><span className="text-[#8b998b]">Not the follower count.</span></h1>
              <p className="max-w-lg text-sm leading-7 text-[#9aa79c] lg:justify-self-end">Search, filter, save, and compare published profiles using their proof, performance, and risk context. Public data comes from immutable snapshots.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
          {operators.length ? (
            <OperatorDirectory operators={operators} />
          ) : (
            <div className="terminal-card px-6 py-16 text-center">
              <ShieldCheck className="mx-auto h-7 w-7 text-[#7f8d7e]" />
              <h2 className="mt-5 text-lg font-medium">No public records yet.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">Published operator profiles will appear here after their owners choose to make a record public.</p>
              <Link href="/signup" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-zinc-100 px-5 text-sm font-medium text-zinc-950 hover:bg-white">Build the first record</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
