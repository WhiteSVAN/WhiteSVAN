import Link from "next/link";
import { BarChart3, BookOpenText, CandlestickChart, RadioTower, ShieldCheck } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

const FEED = [
  {
    source: "Validation note",
    title: "When a clean Sharpe is just selection bias",
    meta: "Backtest hygiene / deflated Sharpe / parameter sweeps",
  },
  {
    source: "Portfolio research",
    title: "Capital weights can hide factor concentration",
    meta: "Risk contribution / diversification / stress behavior",
  },
  {
    source: "Market structure",
    title: "SPX gamma map into weekly expiration",
    meta: "Dealer positioning / 0DTE / invalidation levels",
  },
  {
    source: "Equity memo",
    title: "Semiconductor capex cycle and earnings revisions",
    meta: "Thesis / counterview / catalyst path",
  },
];

const WORKFLOW = ["Screen", "Validate", "Combine", "Compare", "Diagnose", "Refine"];

const PILLARS = [
  {
    icon: RadioTower,
    title: "Curated quant feed",
    body: "Follow research by topic: market structure, factor studies, portfolio construction, systematic strategies, and single-name deep dives.",
  },
  {
    icon: BarChart3,
    title: "Validation-first discussion",
    body: "Posts are framed around thesis, evidence, assumptions, counterview, risk, and what would invalidate the idea.",
  },
  {
    icon: ShieldCheck,
    title: "Research profiles",
    body: "Members can attach proof-backed performance snapshots, update history, and evidence without turning the network into copy-trading.",
  },
];

const ACCESS = [
  { name: "Reader", price: "$0", blurb: "Read public research profiles and join the beta list" },
  { name: "Researcher", price: "$49", blurb: "Publish briefs, join research rooms, and maintain a profile" },
  { name: "Team", price: "$199", blurb: "Private rooms, team profiles, and a shared research archive" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-base font-semibold tracking-[0.18em] text-slate-100">
            QUANT <span className="text-cyan-300">CONNECT</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/network" className="text-slate-300 hover:text-white">
              Network
            </Link>
            <Link href="/explore" className="text-slate-300 hover:text-white">
              Directory
            </Link>
            <Link href="/login" className="hidden text-slate-300 hover:text-white sm:inline">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-cyan-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-cyan-300"
            >
              Join beta
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

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-18 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                <CandlestickChart className="h-4 w-4" aria-hidden="true" />
                Professional quant research network
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Quant Connect is where traders publish research that can be challenged.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                A professional network for systematic traders, quant researchers, prop-firm traders,
                brokers, and independent analysts to share GEX notes, strategy validation, portfolio
                research, and stock deep dives with a visible research trail.
              </p>
              <div className="mt-8 max-w-xl">
                <WaitlistForm />
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/signup"
                  className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300"
                >
                  Create research profile
                </Link>
                <Link
                  href="/network"
                  className="rounded-md border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
                >
                  View network preview
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/85 p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Research feed
                </p>
                <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-300">
                  Peer review
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {FEED.map((item, index) => (
                  <article key={item.title} className="rounded-md border border-slate-800 bg-slate-900/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">
                        {item.source}
                      </p>
                      <span className="font-mono text-xs text-slate-500">0{index + 1}</span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-white">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{item.meta}</p>
                  </article>
                ))}
              </div>
              <div className="mt-5 rounded-md border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Research loop
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WORKFLOW.map((step) => (
                    <div key={step} className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                      <p className="text-sm font-medium text-slate-100">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Built like a research terminal, not a noisy feed
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Quant Connect borrows the best pattern from quant aggregators, long-form research,
                and strategy libraries: useful work is structured, timestamped, and open to scrutiny.
              </p>
            </div>
            <BookOpenText className="h-8 w-8 text-cyan-300" aria-hidden="true" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article key={pillar.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                  <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950/70">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Simple beta access</h2>
            <p className="mt-2 text-sm text-slate-400">Free during early research-profile onboarding.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {ACCESS.map((plan) => (
                <div key={plan.name} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-medium text-slate-400">{plan.name}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {plan.price}
                    <span className="text-sm font-normal text-slate-500">/mo</span>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{plan.blurb}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-6 text-slate-500">
          Quant Connect is research, analytics, and professional networking software. It does not
          manage money, execute trades, provide investment advice, or guarantee performance.
        </div>
      </footer>
    </div>
  );
}
