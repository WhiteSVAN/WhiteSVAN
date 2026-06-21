import Link from "next/link";
import { BarChart3, BookOpenText, CandlestickChart, RadioTower, ShieldCheck } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

const TAPE = [
  { ticker: "SPX", regime: "Positive GEX", level: "+4.8B", tone: "text-emerald-300" },
  { ticker: "NVDA", regime: "Vol expansion", level: "-1.2B", tone: "text-red-300" },
  { ticker: "TSLA", regime: "Call wall", level: "245", tone: "text-amber-300" },
  { ticker: "QQQ", regime: "HVL test", level: "531.20", tone: "text-cyan-300" },
];

const DESKS = [
  {
    icon: RadioTower,
    title: "GEX and flow rooms",
    body: "Discuss gamma walls, dealer hedging, 0DTE structure, skew shifts, and volatility regimes by ticker.",
  },
  {
    icon: BookOpenText,
    title: "Stock deep dives",
    body: "Publish long-form equity theses with valuation notes, catalysts, risks, charts, and counterviews.",
  },
  {
    icon: ShieldCheck,
    title: "Verified operator profiles",
    body: "Attach trading history, proof level, drawdown behavior, and discipline metrics to your professional identity.",
  },
];

const BRIEFS = [
  "SPX gamma flip and dealer stabilization map",
  "SOXX valuation stress test after AI capex revisions",
  "AAPL collar flow into earnings week",
  "Small-cap breadth divergence with liquidity filters",
];

const PRICING = [
  { name: "Observer", price: "$0", blurb: "Read public desks, publish a profile, join the beta" },
  { name: "Operator", price: "$49", blurb: "Quant briefs, GEX rooms, verified performance card" },
  { name: "Desk", price: "$199", blurb: "Team profiles, private rooms, research archive" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-base font-semibold tracking-[0.18em] text-slate-100">
            SVAN <span className="text-cyan-300">CAPITAL</span>
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
          <div className="absolute inset-0 opacity-40">
            <div className="h-full w-full bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                <CandlestickChart className="h-4 w-4" aria-hidden="true" />
                Trader-only research network
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                SVAN Capital is a darker, sharper desk for market operators.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Built for professional traders to network, publish GEX and quant analysis, write
                serious stock deep dives, and prove the quality of their process without noisy social
                trading mechanics.
              </p>
              <div className="mt-8 max-w-xl">
                <WaitlistForm />
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/signup"
                  className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300"
                >
                  Create operator profile
                </Link>
                <Link
                  href="/network"
                  className="rounded-md border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:border-cyan-400 hover:text-white"
                >
                  View network preview
                </Link>
              </div>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Live desk tape
                  </p>
                  <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300">
                    Market open
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {TAPE.map((item) => (
                    <div key={item.ticker} className="rounded-md border border-slate-800 bg-slate-900/80 p-3">
                      <p className="font-mono text-sm font-semibold text-white">{item.ticker}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.regime}</p>
                      <p className={`mt-3 font-mono text-lg font-semibold ${item.tone}`}>{item.level}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 h-28 rounded-md border border-slate-800 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),transparent_40%),linear-gradient(45deg,rgba(16,185,129,0.16),transparent_45%),#020617] p-4">
                  <div className="flex h-full items-end gap-2">
                    {[34, 52, 44, 68, 57, 81, 63, 72, 48, 88, 79, 96].map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className="flex-1 rounded-t bg-cyan-300/70"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/30">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Research queue
                </p>
                <div className="mt-4 space-y-3">
                  {BRIEFS.map((brief, index) => (
                    <div key={brief} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
                      <p className="text-xs text-slate-500">Brief 0{index + 1}</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">{brief}</p>
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
              <h2 className="text-2xl font-semibold tracking-tight text-white">Built like a desk, not a feed</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                SVAN Capital combines the best parts of trader rooms, paid research, and market
                structure dashboards into a controlled professional network.
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-cyan-300" aria-hidden="true" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {DESKS.map((desk) => {
              const Icon = desk.icon;
              return (
                <article key={desk.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
                  <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-white">{desk.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{desk.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950/70">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Simple beta access</h2>
            <p className="mt-2 text-sm text-slate-400">Free during early operator onboarding.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PRICING.map((plan) => (
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
          SVAN Capital is research, analytics, and professional networking software. It does not
          manage money, execute trades, provide investment advice, or guarantee performance.
        </div>
      </footer>
    </div>
  );
}
