import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  FileText,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Trophy,
  UploadCloud,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { formatPercent } from "@/lib/format";
import { publishedTrustFromMetrics } from "@/lib/published-profile";

export const metadata: Metadata = { title: "Verified traders - Quantidive" };

type NetworkType = "all" | "gex" | "deep-dive" | "portfolio" | "systematic";

const FILTERS: { key: NetworkType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gex", label: "Market structure" },
  { key: "deep-dive", label: "Equity research" },
  { key: "portfolio", label: "Portfolio" },
  { key: "systematic", label: "Systematic" },
];

const TYPE_LABELS: Record<Exclude<NetworkType, "all">, string> = {
  gex: "Market structure",
  "deep-dive": "Equity research",
  portfolio: "Portfolio",
  systematic: "Systematic",
};

const TYPE_STYLES: Record<Exclude<NetworkType, "all">, string> = {
  gex: "bg-cyan-950/70 text-cyan-200",
  "deep-dive": "bg-amber-950/70 text-amber-200",
  portfolio: "bg-blue-950/70 text-blue-200",
  systematic: "bg-violet-950/70 text-violet-200",
};

const STEPS = [
  {
    icon: UploadCloud,
    title: "Import real history",
    body: "Start from broker or prop-firm CSV exports, then attach statements or tax records for stronger proof.",
  },
  {
    icon: ShieldCheck,
    title: "Publish a proof-backed profile",
    body: "Quantidive calculates risk, PnL, freshness, and score from the imported data. Public pages show the proof level.",
  },
  {
    icon: Trophy,
    title: "Get discovered on substance",
    body: "Clients, peers, brokers, and firms can review a record instead of guessing from screenshots or follower count.",
  },
];

const DISCUSSION_ROOMS = [
  {
    name: "GEX and market structure",
    access: "Public profile + Proof L3+",
    prompt: "Share gamma levels, dealer-flow assumptions, invalidation, and what would prove the read wrong.",
  },
  {
    name: "Systematic research lab",
    access: "Verified data source",
    prompt: "Post the rule, sample window, costs, out-of-sample behavior, failure mode, and monitoring plan.",
  },
  {
    name: "Portfolio diligence",
    access: "Proof L3+ or client reviewer",
    prompt: "Discuss concentration, correlation, factor exposure, drawdown behavior, and rebalancing discipline.",
  },
  {
    name: "Private markets desk",
    access: "Invite-only reviewer room",
    prompt: "Use PE-style diligence: thesis, comps, operating metric, covenant/risk signal, source, and next check.",
  },
];

const ACCESS_FLOW = [
  "Connect Discord or a private chat identity",
  "Quantidive publishes proof metadata for linked roles",
  "Rooms unlock by proof level, style, and reviewer status",
  "AI summarizes threads into non-advisory research briefs",
];

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const { type } = await searchParams;
  const activeType = FILTERS.some((f) => f.key === type) ? (type as NetworkType) : "all";

  const [profiles, latestVersion] = await Promise.all([
    prisma.traderProfile.findMany({
      where: { isPublic: true },
      select: {
        slug: true,
        displayName: true,
        headline: true,
        strategy: true,
        instruments: true,
        openToWork: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { metrics: true, proofLevel: true, transparencyScore: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.profileVersion.findFirst({
      where: { profileId: user.profile.id },
      orderBy: { versionNumber: "desc" },
      select: { proofLevel: true, transparencyScore: true },
    }),
  ]);

  const members = profiles.map((profile) => {
    const trust = publishedTrustFromMetrics(profile.versions[0]?.metrics)?.trust ?? null;
    const memberType = inferMemberType(profile.strategy, profile.instruments);
    return { profile, trust, memberType };
  });

  const filteredMembers =
    activeType === "all" ? members : members.filter((member) => member.memberType === activeType);
  const verifiedCount = members.filter((member) => (member.profile.versions[0]?.proofLevel ?? 1) >= 3).length;
  const openToWorkCount = members.filter((member) => member.profile.openToWork).length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-300">
              <Users className="h-4 w-4" aria-hidden="true" />
              Verified trader board
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Public profiles with proof, freshness, and computed risk.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Quantidive profiles are built to make real trading records easier to inspect. Every
              profile can show where the numbers came from, how current they are, and what proof
              level supports the published record.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Public profiles" value={String(members.length)} />
              <Metric label="Verified L3+" value={String(verifiedCount)} />
              <Metric label="Open to work" value={String(openToWorkCount)} />
            </div>
          </div>

          <aside className="border-t border-slate-800 bg-slate-950/70 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Your profile</p>
                <p className="mt-1 text-sm text-slate-400">{user.profile.displayName}</p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  user.profile.isPublic
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {user.profile.isPublic ? "Public" : "Private"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric
                label="Proof level"
                value={latestVersion ? `L${latestVersion.proofLevel}` : "-"}
              />
              <Metric
                label="Score"
                value={latestVersion ? String(latestVersion.transparencyScore) : "-"}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={user.profile.isPublic ? `/p/${user.profile.slug}` : "/settings"}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {user.profile.isPublic ? "View profile" : "Publish profile"}
              </Link>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Import data
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
                <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                <h2 className="mt-4 font-semibold text-white">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-300">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Verified discussion rooms
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Join chat by proof, not hype.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Quantidive can sit in front of Discord or private chat groups as the verification
              layer. Traders keep the conversation practical by posting evidence, assumptions,
              counterviews, and monitoring notes instead of raw alerts.
            </p>
            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                <LockKeyhole className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                Access model
              </p>
              <div className="mt-4 space-y-3">
                {ACCESS_FLOW.map((item, index) => (
                  <div key={item} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-300">
                      {index + 1}
                    </span>
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {DISCUSSION_ROOMS.map((room) => (
              <article key={room.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-white">{room.name}</h3>
                  <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-200">
                    {room.access}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{room.prompt}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Bot className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            AI room assistant
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Turn this thread into a diligence memo: thesis, evidence cited, assumptions, risks,
            counterarguments, open questions, and what data should be checked next.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Verified profiles</h2>
            <p className="mt-1 text-sm text-slate-400">
              Filter by research style and inspect the published track record behind each profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/network" : `/network?type=${filter.key}`}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  activeType === filter.key
                    ? "border-cyan-500 bg-cyan-500 text-slate-950"
                    : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
            <h3 className="text-sm font-medium text-white">No matching public profiles yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
              Publish your profile or clear the filter to see every trader currently visible on the board.
            </p>
            <Link
              href={activeType === "all" ? "/settings" : "/network"}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              {activeType === "all" ? "Open settings" : "Clear filter"}
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.profile.slug}
                displayName={member.profile.displayName}
                slug={member.profile.slug}
                headline={member.profile.headline}
                strategy={member.profile.strategy}
                instruments={member.profile.instruments}
                openToWork={member.profile.openToWork}
                type={member.memberType}
                proofLevel={member.profile.versions[0]?.proofLevel ?? null}
                trustScore={member.profile.versions[0]?.transparencyScore ?? null}
                returnPct={member.trust?.metrics.returnPct ?? null}
                maxDrawdownPct={member.trust?.metrics.maxDrawdownPct ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function MemberCard({
  displayName,
  slug,
  headline,
  strategy,
  instruments,
  openToWork,
  type,
  proofLevel,
  trustScore,
  returnPct,
  maxDrawdownPct,
}: {
  displayName: string;
  slug: string;
  headline: string | null;
  strategy: string | null;
  instruments: string | null;
  openToWork: boolean;
  type: Exclude<NetworkType, "all">;
  proofLevel: number | null;
  trustScore: number | null;
  returnPct: number | null;
  maxDrawdownPct: number | null;
}) {
  return (
    <Link
      href={`/p/${slug}`}
      className="block rounded-lg border border-slate-800 bg-slate-950/50 p-5 transition hover:border-cyan-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
            {initials(displayName)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white">{displayName}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-400">
              {headline || [strategy, instruments].filter(Boolean).join(" / ") || "Professional trader"}
            </p>
          </div>
        </div>
        <span className={`flex-none rounded px-2 py-1 text-xs font-medium ${TYPE_STYLES[type]}`}>
          {TYPE_LABELS[type]}
        </span>
      </div>
      {openToWork && (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Open to work
        </span>
      )}
      <div className="mt-5 grid grid-cols-4 gap-2 text-sm">
        <Mini label="Proof" value={proofLevel ? `L${proofLevel}` : "-"} />
        <Mini label="Score" value={trustScore != null ? String(trustScore) : "-"} />
        <Mini label="Return" value={returnPct != null ? formatPercent(returnPct, 0) : "-"} />
        <Mini label="Drop" value={maxDrawdownPct != null ? `${maxDrawdownPct.toFixed(0)}%` : "-"} />
      </div>
      <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300">
        <FileText className="h-4 w-4" aria-hidden="true" />
        View verified profile
      </p>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function inferMemberType(
  strategy: string | null,
  instruments: string | null,
): Exclude<NetworkType, "all"> {
  const text = `${strategy ?? ""} ${instruments ?? ""}`.toLowerCase();
  if (text.includes("gex") || text.includes("gamma") || text.includes("0dte")) return "gex";
  if (text.includes("deep") || text.includes("value") || text.includes("fundamental")) return "deep-dive";
  if (
    text.includes("portfolio") ||
    text.includes("allocation") ||
    text.includes("factor") ||
    text.includes("risk parity") ||
    text.includes("divers")
  ) {
    return "portfolio";
  }
  if (
    text.includes("quant") ||
    text.includes("system") ||
    text.includes("algo") ||
    text.includes("rules")
  ) {
    return "systematic";
  }
  return "deep-dive";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
