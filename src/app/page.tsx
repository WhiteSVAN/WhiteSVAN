import Link from "next/link";
import {
  Activity,
  Bot,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { WaitlistForm } from "./waitlist-form";
import { BrokerLogos } from "@/components/broker-logos";

const PROOF_STEPS = [
  "Import broker or prop-firm history",
  "Quantidive computes the metrics",
  "Attach statements or tax records",
  "Share a verified public profile",
];

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
    body: "A public Quantidive profile ties performance, proof level, freshness, and risk metrics to a record that can be reviewed.",
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
        <section className="relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 opacity-35">
            <div className="h-full w-full bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-18 sm:py-24 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Verification + diligence workspace
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                The proof layer for traders, plus the diligence workspace for clients.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Quantidive combines public trader verification with an AI-ready workflow for
                screening, reviewing, monitoring, and reporting on trading talent. Traders prove the
                record; clients and firms get a cleaner way to diligence it.
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
                    Public profile
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Ava Demo</h2>
                  <p className="mt-1 text-sm text-slate-400">Systematic futures / SPX gamma</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ProfileMetric label="Proof level" value="L4" detail="Tax record checked" />
                <ProfileMetric label="Freshness" value="Fresh" detail="Updated 2d ago" />
                <ProfileMetric label="Research score" value="87/100" detail="Code computed" />
                <ProfileMetric label="Data source" value="Broker CSV" detail="Hash recorded" />
              </div>

              <div className="mt-5 rounded-md border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Verification path
                </p>
                <div className="mt-4 space-y-3">
                  {PROOF_STEPS.map((step, index) => (
                    <div key={step} className="flex items-center gap-3 text-sm">
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
                  CSV and statement imports work today. Direct connections can sit behind the same
                  proof system later without changing the public profile model.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                14+ brokers &amp; prop firms
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
