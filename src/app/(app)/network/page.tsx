import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Factory,
  FileText,
  MessageSquareText,
  Radar,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { formatPercent } from "@/lib/format";
import { publishedTrustFromMetrics } from "@/lib/published-profile";

export const metadata: Metadata = { title: "Network - Quantidive" };

type NetworkType = "all" | "gex" | "deep-dive" | "portfolio" | "systematic";

const FILTERS: { key: NetworkType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gex", label: "Market structure" },
  { key: "deep-dive", label: "Equity research" },
  { key: "portfolio", label: "Portfolio work" },
  { key: "systematic", label: "Systematic" },
];

const TYPE_LABELS: Record<Exclude<NetworkType, "all">, string> = {
  gex: "Market structure",
  "deep-dive": "Equity research",
  portfolio: "Portfolio research",
  systematic: "Systematic research",
};

const TYPE_STYLES: Record<Exclude<NetworkType, "all">, string> = {
  gex: "bg-cyan-950/70 text-cyan-200",
  "deep-dive": "bg-amber-950/70 text-amber-200",
  portfolio: "bg-blue-50 text-blue-700",
  systematic: "bg-violet-50 text-violet-700",
};

const ROOMS: {
  title: string;
  description: string;
  fit: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    title: "Market structure and GEX",
    description: "Gamma walls, dealer hedging, 0DTE structure, skew shifts, and volatility regimes by ticker.",
    fit: "SPX, SPY, QQQ, single-stock options",
    icon: Radar,
    tone: "bg-cyan-950/70 text-cyan-200",
  },
  {
    title: "Equity deep dives",
    description: "Long-form stock research with valuation, catalysts, risks, bear cases, and rebuttals.",
    fit: "Research memos, counterviews, catalysts",
    icon: FileText,
    tone: "bg-amber-950/70 text-amber-200",
  },
  {
    title: "Portfolio construction",
    description: "Allocation notes, factor overlap, risk contribution, regime stress, and diversification checks.",
    fit: "Risk parity, factor mix, drawdowns",
    icon: Factory,
    tone: "bg-blue-950/70 text-blue-200",
  },
  {
    title: "Systematic research lab",
    description: "Rules-based researchers discussing regimes, validation, scanners, backtests, and failure modes.",
    fit: "Models, data quality, risk controls",
    icon: Building2,
    tone: "bg-violet-950/70 text-violet-200",
  },
];

const SIGNALS = [
  {
    label: "Market structure",
    title: "SPX positive gamma may dampen realized volatility into the close",
    detail: "A useful post includes the gamma flip, largest call/put walls, expiration concentration, and invalidation level.",
    tone: "border-cyan-900/70 bg-cyan-950/40 text-cyan-100",
  },
  {
    label: "Validation",
    title: "A high in-sample Sharpe can still be noise",
    detail: "Members are expected to show trial count, assumptions, out-of-sample behavior, costs, and failure cases.",
    tone: "border-amber-900/70 bg-amber-950/40 text-amber-100",
  },
  {
    label: "Portfolio note",
    title: "Equal capital weights can still mean concentrated risk",
    detail: "Portfolio posts should identify factor overlap, correlation, stress behavior, and the benchmark being improved.",
    tone: "border-emerald-900/70 bg-emerald-950/40 text-emerald-100",
  },
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
        strategy: true,
        instruments: true,
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
  const visibleMembers = filteredMembers.slice(0, 9);
  const proofReadyCount = members.filter((member) => (member.profile.versions[0]?.proofLevel ?? 1) >= 3).length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-300">
              <Users className="h-4 w-4" aria-hidden="true" />
              Quantidive network
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              A research network for quants, systematic traders, and market analysts.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Think curated quant links, long-form research memos, and strategy-library discipline,
              but built around professional profiles, peer review, and evidence-backed performance records.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Researchers" value={String(members.length)} />
              <Metric label="Proof-backed" value={String(proofReadyCount)} />
              <Metric label="Research rooms" value={String(ROOMS.length)} />
            </div>
          </div>
          <aside className="border-t border-slate-800 bg-slate-950/70 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Your research profile</p>
                <p className="mt-1 text-sm text-slate-500">{user.profile.displayName}</p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  user.profile.isPublic
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {user.profile.isPublic ? "Visible" : "Private"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric
                label="Proof Level"
                value={latestVersion ? String(latestVersion.proofLevel) : "-"}
              />
              <Metric
                label="Research Score"
                value={latestVersion ? String(latestVersion.transparencyScore) : "-"}
              />
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-blue-700" aria-hidden="true" />
                Network identity is anchored to a published Quantidive profile, not follower count.
              </p>
              <p className="flex gap-2">
                <MessageSquareText className="mt-0.5 h-4 w-4 flex-none text-blue-700" aria-hidden="true" />
                Posts are structured around thesis, method, evidence, counterview, risk, and replication notes.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={user.profile.isPublic ? `/p/${user.profile.slug}` : "/settings"}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {user.profile.isPublic ? "View profile" : "Publish profile"}
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Proof settings
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Research rooms</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dedicated areas for market structure, equity research, portfolio construction, and systematic work.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {ROOMS.map((room) => {
            const Icon = room.icon;
            return (
              <article key={room.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className={`rounded-lg p-2 ${room.tone}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{room.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{room.description}</p>
                    <p className="mt-3 text-xs font-medium uppercase text-slate-400">{room.fit}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Research tape</h2>
          </div>
          <div className="mt-4 space-y-3">
            {SIGNALS.map((signal) => (
              <article key={signal.title} className={`rounded-lg border p-4 ${signal.tone}`}>
                <p className="text-xs font-semibold uppercase">{signal.label}</p>
                <h3 className="mt-1 font-semibold">{signal.title}</h3>
                <p className="mt-1 text-sm leading-6 opacity-85">{signal.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Publishing standards</h2>
          </div>
          <ul className="mt-4 space-y-4 text-sm text-slate-600">
            <Standard title="Professional-only context">
              The network is for professional market discussion, peer review, and research distribution.
            </Standard>
            <Standard title="Evidence before promotion">
              Research profiles show published versions, Proof Level, and risk metrics before social reach.
            </Standard>
            <Standard title="Structured disagreement">
              Every strong view should include method, counterview, invalidation, and risk context.
            </Standard>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Researcher directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Published profiles become professional research cards with process, proof, and track-record context attached.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/network" : `/network?type=${filter.key}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  activeType === filter.key
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>

        {visibleMembers.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
            <h3 className="text-sm font-medium text-slate-800">No matching public profiles yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Publish your own Quantidive research profile or clear the filter to see every trader
              currently visible on the network.
            </p>
            <Link
              href={activeType === "all" ? "/settings" : "/network"}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              {activeType === "all" ? "Open settings" : "Clear filter"}
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMembers.map((member) => (
              <MemberCard
                key={member.profile.slug}
                displayName={member.profile.displayName}
                slug={member.profile.slug}
                strategy={member.profile.strategy}
                instruments={member.profile.instruments}
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
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Standard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
      <span>
        <span className="font-medium text-slate-900">{title}</span>
        <span className="block leading-6">{children}</span>
      </span>
    </li>
  );
}

function MemberCard({
  displayName,
  slug,
  strategy,
  instruments,
  type,
  proofLevel,
  trustScore,
  returnPct,
  maxDrawdownPct,
}: {
  displayName: string;
  slug: string;
  strategy: string | null;
  instruments: string | null;
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
            <h3 className="truncate font-semibold text-slate-900">{displayName}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {[strategy, instruments].filter(Boolean).join(" / ") || "Professional trader"}
            </p>
          </div>
        </div>
        <span className={`flex-none rounded px-2 py-1 text-xs font-medium ${TYPE_STYLES[type]}`}>
          {TYPE_LABELS[type]}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 text-sm">
        <Mini label="Proof" value={proofLevel ? `L${proofLevel}` : "-"} />
        <Mini label="Score" value={trustScore != null ? String(trustScore) : "-"} />
        <Mini label="Return" value={returnPct != null ? formatPercent(returnPct, 0) : "-"} />
        <Mini label="Drop" value={maxDrawdownPct != null ? `${maxDrawdownPct.toFixed(0)}%` : "-"} />
      </div>
      <p className="mt-4 text-sm font-medium text-cyan-300">View research profile</p>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</p>
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
