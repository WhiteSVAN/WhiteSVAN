import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Bot,
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  Link2,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { WaitlistForm } from "./waitlist-form";
import { BrokerLogos } from "@/components/broker-logos";
import { SiteFooter } from "@/components/site-footer";

const TRUST_CARDS = [
  {
    title: "Proof",
    body: "Broker-reported history, statements, and tax records behind the public profile.",
  },
  {
    title: "Forum",
    body: "Threaded, source-backed research across GEX, systematic strategies, portfolios, and diligence.",
  },
  {
    title: "Briefs",
    body: "AI-ready notes from code-computed metrics and source-backed discussions.",
  },
];

const WORKSPACE_STEPS = [
  {
    icon: FileSearch,
    title: "Screen",
    body: "Find verified traders by strategy, instrument, proof level, open-to-work status, drawdown, and research score.",
  },
  {
    icon: ClipboardCheck,
    title: "Diligence",
    body: "Review source-linked performance, evidence, freshness, redactions, and risk flags from one profile.",
  },
  {
    icon: Activity,
    title: "Monitor",
    body: "Track version changes, stale profiles, proof upgrades, and meaningful shifts in drawdown or concentration.",
  },
  {
    icon: BookOpenCheck,
    title: "Report",
    body: "Turn verified metrics into research briefs and client-ready summaries without reassembling spreadsheets.",
  },
];

const FORUM_STEPS = [
  {
    icon: LockKeyhole,
    title: "Proof-gated posting",
    body: "Posting weight and badges tie to Quantidive proof level, freshness, and public profile status — verified voices stand out.",
  },
  {
    icon: MessageSquare,
    title: "Structured strategy threads",
    body: "Threads are organized around thesis, data source, backtest, risk, counterview, and monitoring notes.",
  },
  {
    icon: Bot,
    title: "AI research operator",
    body: "AI turns long threads into source-linked summaries, unanswered questions, and diligence-ready briefs.",
  },
];

const FORUM_CATEGORIES = [
  "GEX and market structure",
  "Systematic research lab",
  "Portfolio construction",
  "Private markets diligence",
];

const FEATURED_PROFILES = [
  {
    name: "Sofia Alvarez",
    initials: "SA",
    headline: "Proof L4 futures operator",
    style: "SPX gamma / ES / NQ",
    proof: "L4",
    score: "91",
    drawdown: "6%",
    focus: "GEX desk",
  },
  {
    name: "Marcus Chen",
    initials: "MC",
    headline: "Systematic stat-arb researcher",
    style: "Equities / sector ETFs",
    proof: "L3",
    score: "84",
    drawdown: "3%",
    focus: "Systematic lab",
  },
  {
    name: "Priya Nair",
    initials: "PN",
    headline: "Options flow and volatility analyst",
    style: "SPX / SPY / QQQ options",
    proof: "L4",
    score: "88",
    drawdown: "8%",
    focus: "Market structure",
  },
  {
    name: "Noah Okafor",
    initials: "NO",
    headline: "Macro futures researcher",
    style: "Rates / FX / index hedges",
    proof: "L3",
    score: "82",
    drawdown: "5%",
    focus: "Private markets desk",
  },
];

const HERO_TAPE = [
  "Read-only broker links",
  "Proof L4",
  "GEX deep dives",
  "Tax-record verification",
  "Research forum",
  "AI research briefs",
  "Risk context",
];

const VISUAL_PANELS = [
  {
    title: "The record",
    label: "Broker connected",
    body: "Source-backed performance without editable screenshots.",
    position: "object-[42%_52%]",
  },
  {
    title: "The forum",
    label: "Verified access",
    body: "Threaded strategy research gated by proof, freshness, and role.",
    position: "object-[58%_42%]",
  },
  {
    title: "The brief",
    label: "Research desk",
    body: "Metrics, risk events, and notes ready for review.",
    position: "object-[50%_62%]",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col text-slate-100">
      {/* Single full-page city backdrop — one image, no repeat, covers the whole landing. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/images/quantidive-city-night.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,10,0.78)_0%,rgba(3,5,10,0.9)_52%,rgba(3,5,10,0.97)_100%)]" />
      </div>
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:py-4">
          <Link href="/" className="text-base font-semibold tracking-[0.14em] text-slate-100 sm:tracking-[0.18em]">
            QUANTI<span className="text-cyan-300">DIVE</span>
          </Link>
          <div className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/explore" className="text-slate-300 hover:text-white">
              <span className="sm:hidden">Traders</span>
              <span className="hidden sm:inline">Verified traders</span>
            </Link>
            <Link href="/login" className="hidden text-slate-300 hover:text-white sm:inline">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-cyan-500 px-2.5 py-1.5 font-medium text-slate-950 hover:bg-cyan-300 sm:px-3"
            >
              Get verified
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="relative overflow-hidden border-b border-slate-800/70">
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:gap-10 sm:py-24 lg:grid-cols-[0.9fr_1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-slate-950/35 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 backdrop-blur sm:tracking-[0.22em]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Verified trading network
              </p>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                Verified traders. Real records.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
                Broker-reported history becomes profiles, a verified forum, and research briefs.
              </p>
              <div className="mt-8 max-w-xl">
                <WaitlistForm />
              </div>
              <div className="mt-5 grid gap-3 text-sm sm:flex sm:flex-wrap">
                <Link
                  href="/signup"
                  className="rounded-md bg-cyan-500 px-4 py-2 text-center font-medium text-slate-950 hover:bg-cyan-300"
                >
                  Get verified
                </Link>
                <Link
                  href="/explore"
                  className="rounded-md border border-slate-700 px-4 py-2 text-center font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
                >
                  Explore traders
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
                {HERO_TAPE.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-cyan-300" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="qd-fade-up relative min-h-[28rem] overflow-hidden rounded-lg border border-white/15 bg-slate-900/70 shadow-2xl shadow-black/40 sm:min-h-[34rem]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(34,211,238,0.10),transparent_60%),linear-gradient(180deg,#0b1120_0%,#070a12_100%)]" />
              <div className="absolute inset-x-5 top-5 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Public profile</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                  Verified
                </span>
              </div>
              <div className="absolute inset-x-5 top-16">
                <p className="text-xl font-semibold text-white">Sofia Alvarez</p>
                <p className="mt-1 text-sm text-slate-400">Systematic futures / SPX gamma</p>
              </div>
              <div className="absolute inset-x-4 bottom-4 grid gap-3 sm:grid-cols-2">
                <ProfileMetric label="Proof" value="L4" detail="Tax record + statement" />
                <ProfileMetric label="Fresh" value="7d" detail="Updated this week" />
                <ProfileMetric label="Score" value="91" detail="Code computed" />
                <ProfileMetric label="Drop" value="5.8%" detail="Published window" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_CARDS.map((card) => (
              <article key={card.title} className="qd-fade-up rounded-lg border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-4 md:grid-cols-3">
            {VISUAL_PANELS.map((panel) => (
              <ImagePanel key={panel.title} {...panel} />
            ))}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950/70">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
                  More verified profiles
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Verified desks.
                </h2>
              </div>
              <Link
                href="/explore"
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
              >
                View directory
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FEATURED_PROFILES.map((profile) => (
                <article key={profile.name} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                        {profile.initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-white">{profile.name}</h3>
                        <p className="mt-0.5 truncate text-sm text-slate-400">{profile.headline}</p>
                      </div>
                    </div>
                    <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-200">
                      {profile.proof}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-slate-300">{profile.style}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <ProfileMini label="Score" value={profile.score} />
                    <ProfileMini label="Drop" value={profile.drawdown} />
                    <ProfileMini label="Focus" value={profile.focus} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950/70">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
                <FileSearch className="h-4 w-4" aria-hidden="true" />
                From proof to workflow
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Diligence, simplified.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Compare candidates, review evidence, monitor changes, and publish clean updates.
              </p>
              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Ask Quantidive
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Show verified systematic futures traders with Proof L3+, fresh data, max drawdown
                  under 12%, and published research in the last 30 days.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {WORKSPACE_STEPS.map((point) => {
                const Icon = point.icon;
                return (
                  <article key={point.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                    <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                    <h3 className="mt-4 font-semibold text-white">{point.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{point.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Verified research forum
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                A forum, not a chat room.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Verified participants, organized evidence, clear ownership, and a record of what
                changed.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {FORUM_CATEGORIES.map((room) => (
                  <div
                    key={room}
                    className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
                  >
                    {room}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {FORUM_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                    <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                    <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Connect the broker you use.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Read-only history, automatic metrics, no trade execution, no hand-edited records.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Read-only broker links
              </span>
            </div>
            <div className="mt-6">
              <BrokerLogos />
            </div>
          </div>
        </section>
      </main>

      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}

function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/80 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function ImagePanel({
  title,
  label,
  body,
}: {
  title: string;
  label: string;
  body: string;
}) {
  return (
    <article className="qd-fade-up group relative min-h-72 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.10),transparent_55%),linear-gradient(180deg,#0b1120_0%,#070a12_100%)] transition duration-700 group-hover:bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.16),transparent_55%),linear-gradient(180deg,#0b1120_0%,#070a12_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">{label}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
      </div>
    </article>
  );
}

function ProfileMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
