import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Bot,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Link2,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { WaitlistForm } from "./waitlist-form";
import { BrokerLogos } from "@/components/broker-logos";

const TRUST_CARDS = [
  {
    title: "The situation",
    body: "Trading results online are usually screenshots, cropped charts, and claims that cannot be inspected.",
  },
  {
    title: "The problem",
    body: "Serious traders look the same as promoters when clients, firms, and peers cannot tell what is real.",
  },
  {
    title: "The solution",
    body: "A public Quantidive profile ties broker-reported performance, proof level, freshness, and risk metrics to a record that can be reviewed.",
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

const ROOM_STEPS = [
  {
    icon: LockKeyhole,
    title: "Proof-gated rooms",
    body: "Discord or private chat access can be tied to Quantidive proof level, freshness, and public profile status.",
  },
  {
    icon: MessageSquare,
    title: "Structured strategy threads",
    body: "Rooms are organized around thesis, data source, backtest, risk, counterview, and monitoring notes.",
  },
  {
    icon: Bot,
    title: "AI research operator",
    body: "AI turns long discussions into source-linked summaries, unanswered questions, and diligence-ready briefs.",
  },
];

const COMMUNITY_ROOMS = [
  "GEX and market structure",
  "Systematic research lab",
  "Portfolio construction",
  "Private markets diligence",
];

const FEATURED_PROFILES = [
  {
    name: "Ava Rao",
    initials: "AR",
    headline: "Proof L4 futures operator",
    style: "SPX gamma / ES / NQ",
    proof: "L4",
    score: "91",
    drawdown: "6%",
    room: "GEX desk",
  },
  {
    name: "Marcus Chen",
    initials: "MC",
    headline: "Systematic stat-arb researcher",
    style: "Equities / sector ETFs",
    proof: "L3",
    score: "84",
    drawdown: "3%",
    room: "Systematic lab",
  },
  {
    name: "Priya Nair",
    initials: "PN",
    headline: "Options flow and volatility analyst",
    style: "SPX / SPY / QQQ options",
    proof: "L4",
    score: "88",
    drawdown: "8%",
    room: "Market structure",
  },
  {
    name: "Noah Okafor",
    initials: "NO",
    headline: "Macro futures researcher",
    style: "Rates / FX / index hedges",
    proof: "L3",
    score: "82",
    drawdown: "5%",
    room: "Private markets desk",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-base font-semibold tracking-[0.18em] text-slate-100">
            QUANTI<span className="text-cyan-300">DIVE</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/explore" className="text-slate-300 hover:text-white">
              Verified traders
            </Link>
            <Link href="/login" className="hidden text-slate-300 hover:text-white sm:inline">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-cyan-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-cyan-300"
            >
              Get verified
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
          <Image
            src="/images/quantidive-city-night.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[54%_44%] opacity-55"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.82)_46%,rgba(2,6,23,0.5)_100%)]" />
          <div className="absolute inset-0 bg-slate-950/20" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950 to-transparent" />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-18 sm:py-24 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Private verification network
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                A private network for verified market operators.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Quantidive combines public trader verification with an AI-ready workflow for
                screening, reviewing, monitoring, and reporting on trading talent. Traders prove the
                record through source-linked history; clients and firms get a cleaner way to
                diligence it.
              </p>
              <div className="mt-8 max-w-xl">
                <WaitlistForm />
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/signup"
                  className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300"
                >
                  Get verified
                </Link>
                <Link
                  href="/explore"
                  className="rounded-md border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
                >
                  Browse verified traders
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-5 shadow-2xl shadow-black/30">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Verified operator profile
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Ava Rao</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Proof L4 futures operator / SPX gamma and intraday risk
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ProfileMetric label="Proof level" value="L4" detail="Tax record + statement" />
                <ProfileMetric label="Freshness" value="Fresh" detail="Updated this week" />
                <ProfileMetric label="Quantidive score" value="91/100" detail="Code computed" />
                <ProfileMetric label="Max drawdown" value="5.8%" detail="Published window" />
              </div>

              <div className="mt-5 rounded-md border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Diligence snapshot
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    "GEX and futures process is published, not implied from screenshots",
                    "Mid-period drawdown recovered before the latest profile update",
                    "Best-day dependency is flagged for reviewer follow-up",
                  ].map((step, index) => (
                    <div key={step} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-300">
                        {index + 1}
                      </span>
                      <span className="text-slate-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_CARDS.map((card) => (
              <article key={card.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{card.body}</p>
              </article>
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
                  A network should look like a desk, not a directory of claims.
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
                    <ProfileMini label="Room" value={profile.room} />
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
                Screen. Diligence. Monitor. Report.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                The verification layer answers whether a record is real. The workspace layer answers
                what to do next: compare candidates, review evidence, monitor changes, and generate
                diligence-ready updates.
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
                Verified strategy rooms
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Make quant discussion easier to trust.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                The community layer should work like a private-market diligence room: verified
                participants, organized evidence, clear ownership, and a record of what changed.
                Traders can discuss GEX, systematic rules, portfolio construction, and deep dives
                without every thread becoming a signal channel.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {COMMUNITY_ROOMS.map((room) => (
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
              {ROOM_STEPS.map((step) => {
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
                  Verify from the broker or prop firm you already use
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Quantidive is designed around read-only broker and prop-firm connections:
                  broker-reported transactions, automatic performance metrics, no trade execution,
                  and no hand-edited track records.
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

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-6 text-slate-500">
          Quantidive is research, analytics, and professional networking software. It does not manage
          money, execute trades, provide investment advice, or guarantee performance.
        </div>
      </footer>
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
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function ProfileMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
