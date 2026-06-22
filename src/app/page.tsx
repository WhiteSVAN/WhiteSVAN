import type { ReactNode } from "react";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  Layers,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { WaitlistForm } from "./waitlist-form";
import { BrokerLogos } from "@/components/broker-logos";
import { SiteFooter } from "@/components/site-footer";

const HERO_STATS = [
  { value: "3-step", label: "Verification" },
  { value: "14+", label: "Brokers & prop firms" },
  { value: "100%", label: "Code-computed" },
];

const PROOF_LEVELS = [
  { level: "01", label: "Broker-connected", body: "Read-only history imported straight from your broker or prop firm." },
  { level: "02", label: "Statement-checked", body: "A broker or prop-firm statement is on file behind the numbers." },
  { level: "03", label: "Tax-return-checked", body: "A tax return or official tax record backs the account." },
];

const RESEARCH = [
  {
    icon: BarChart3,
    title: "Market structure & GEX",
    body: "Dealer positioning, gamma maps into expiry, 0DTE flow, and the levels that invalidate the read.",
  },
  {
    icon: LineChart,
    title: "Systematic & factor studies",
    body: "The rule, sample window, costs, out-of-sample behavior, deflated Sharpe, and the failure mode.",
  },
  {
    icon: Layers,
    title: "Portfolio construction",
    body: "Risk contribution, factor concentration, correlation, drawdown behavior, and rebalancing discipline.",
  },
  {
    icon: FileSearch,
    title: "Single-name diligence",
    body: "Thesis, counterview, catalyst path, and earnings-revision context — with the source attached.",
  },
];

const STEPS = [
  { n: "01", title: "Connect or import", body: "Read-only broker history, statement, or CSV export — no trade execution, ever." },
  { n: "02", title: "Get a proof level", body: "Code computes the metrics; statements and tax records lift you up the proof ladder." },
  { n: "03", title: "Publish & get discovered", body: "Share an operator card clients, allocators, and prop firms can actually inspect." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#05070d] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-900 bg-[#05070d]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="text-sm font-semibold tracking-[0.18em] text-slate-100">
            <SvanLogo />
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/explore" className="text-slate-400 hover:text-white">
              Verified traders
            </Link>
            <Link href="/login" className="hidden text-slate-400 hover:text-white sm:inline">
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
        {/* Hero */}
        <section className="border-b border-slate-900">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                Verified trading network
              </p>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
                Performance you can&apos;t fake. Research you can inspect.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                TrustSVAN turns broker-reported history into proof-backed profiles, then layers
                structured research — market structure, factor studies, portfolio construction, and
                single-name diligence — that anyone can scrutinize.
              </p>
              <div className="mt-7 max-w-md">
                <WaitlistForm />
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link href="/signup" className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300">
                  Get verified
                </Link>
                <Link href="/explore" className="rounded-md border border-slate-800 px-4 py-2 font-medium text-slate-300 hover:border-cyan-400 hover:text-white">
                  Explore traders
                </Link>
              </div>
              <dl className="mt-9 grid max-w-md grid-cols-3 gap-6 border-t border-slate-900 pt-6">
                {HERO_STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-slate-500">{s.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-white">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <OperatorCard />
          </div>
        </section>

        {/* Logo wall */}
        <section className="border-b border-slate-900 bg-[#070a12]">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Verify from the broker or prop firm you already trade
            </p>
            <div className="mt-6">
              <BrokerLogos />
            </div>
          </div>
        </section>

        {/* Feature: verified performance */}
        <FeatureRow
          eyebrow="Fund-grade performance"
          title="Institutional metrics, computed — not claimed"
          body="Import once and TrustSVAN derives the risk- and return-adjusted metrics allocators actually underwrite — Sharpe, Sortino, CAGR, volatility, max drawdown, and verified capital base — all in code, from the trades."
          points={["Sharpe, Sortino & volatility", "CAGR & verified AUM", "Max drawdown & recovery", "Win rate & profit factor"]}
          visual={<PerformancePanel />}
        />

        {/* Feature: proof levels */}
        <FeatureRow
          flip
          eyebrow="Verification"
          title="Verified at the source, not by screenshot"
          body="It starts with read-only broker history — no self-reported numbers. Add a statement or a tax record to raise your proof level. That's it: connect, then strengthen if you want to."
          points={["Connect your broker (read-only)", "Add statements & tax records", "Proof level on every public card", "$-amount & broker redaction"]}
          visual={<ProofPanel />}
        />

        {/* Feature: discovery */}
        <FeatureRow
          eyebrow="Discovery"
          title="A leaderboard of verified operators"
          body="Browse by strategy, instrument, proof level, drawdown, and research score — ranked by a transparency score computed from the record, not follower count."
          points={["Open-to-work signals", "Strategy & instrument filters", "Proof-level badges", "Freshness & risk context"]}
          visual={<LeaderboardPanel />}
        />

        {/* Feature: diligence */}
        <FeatureRow
          flip
          eyebrow="For allocators"
          title="Run diligence like a desk — then keep monitoring"
          body="A PE-style read of any verified operator: strengths, risk flags, and what to monitor, drawn from the verified record. A summary of past performance — never an allocation recommendation."
          points={["Strengths & risk flags", "What-to-monitor watchlist", "Proof + freshness context", "Source-linked evidence"]}
          visual={<DiligencePanel />}
        />

        {/* Research depth */}
        <section className="border-b border-slate-900 bg-[#070a12]">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <SectionHead
              eyebrow="Research"
              title="Depth, structured the way analysts work"
              sub="Posts are framed around thesis, evidence, assumptions, counterview, risk, and what would invalidate the idea — not alerts or hype."
            />
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 md:grid-cols-2">
              {RESEARCH.map((r) => {
                const Icon = r.icon;
                return (
                  <article key={r.title} className="bg-[#070a12] p-6">
                    <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                    <h3 className="mt-4 font-semibold text-white">{r.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{r.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <SectionHead eyebrow="How it works" title="From broker export to verified card" />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                  <span className="text-sm font-semibold tabular-nums text-cyan-300">{s.n}</span>
                  <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Get verified. Get inspected. Get hired.
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Build a proof-backed track record serious people can trust.
              </p>
            </div>
            <Link href="/signup" className="rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-300">
              Create your operator card
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* ── Layout helpers ─────────────────────────────────────────────── */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      {sub && <p className="mt-3 text-sm leading-6 text-slate-400">{sub}</p>}
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="border-b border-slate-900">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-20">
        <div className={flip ? "lg:order-2" : ""}>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">{body}</p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-cyan-400" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className={flip ? "lg:order-1" : ""}>{visual}</div>
      </div>
    </section>
  );
}

/* ── Product mockups (in-code, on-brand) ────────────────────────── */

const EQUITY = [
  100, 102, 99, 106, 111, 108, 116, 122, 119, 128, 121, 118, 131, 139, 134, 144, 152, 149, 158, 166,
];

function EquityChart({ height = 132 }: { height?: number }) {
  const w = 320;
  const pad = 6;
  const min = Math.min(...EQUITY);
  const max = Math.max(...EQUITY);
  const x = (i: number) => pad + (i / (EQUITY.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);
  const line = EQUITY.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(EQUITY.length - 1).toFixed(1)} ${height - pad} L${x(0).toFixed(1)} ${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eq)" />
      <path d={line} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-2xl shadow-black/30">
      {children}
    </div>
  );
}

function Stat({ label, value, tone = "white" }: { label: string; value: string; tone?: "white" | "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function OperatorCard() {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Operator card</p>
          <p className="mt-2 text-base font-semibold text-white">Sofia Alvarez</p>
          <p className="text-sm text-slate-500">Systematic futures · SPX gamma</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Tax-verified
        </span>
      </div>
      <div className="mt-4">
        <EquityChart />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="AUM (capital base)" value="$1.2M" />
        <Stat label="CAGR" value="+38.4%" tone="good" />
        <Stat label="Sharpe" value="2.1" tone="good" />
        <Stat label="Max drawdown" value="5.8%" />
      </dl>
    </Panel>
  );
}

function PerformancePanel() {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Account equity</p>
        <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-300">Code-computed</span>
      </div>
      <div className="mt-3">
        <EquityChart height={150} />
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="CAGR" value="+38%" tone="good" />
        <Stat label="Sharpe" value="2.1" />
        <Stat label="Sortino" value="3.0" />
        <Stat label="Volatility" value="12%" />
      </dl>
    </Panel>
  );
}

function ProofPanel() {
  return (
    <Panel>
      <p className="text-sm font-medium text-white">Proof ladder</p>
      <ol className="mt-3 space-y-2">
        {PROOF_LEVELS.map((p) => {
          const active = p.level === "03";
          return (
            <li
              key={p.level}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                active ? "border-cyan-400/40 bg-cyan-400/10" : "border-slate-800 bg-slate-950/40"
              }`}
            >
              <span className={`text-xs font-semibold tabular-nums ${active ? "text-cyan-300" : "text-slate-500"}`}>
                {p.level}
              </span>
              <span className={`text-sm ${active ? "font-medium text-white" : "text-slate-400"}`}>{p.label}</span>
              {active && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-300">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Current
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

const LEADERS = [
  { rank: "1", name: "Sofia Alvarez", style: "SPX gamma · ES", score: "91", proof: "Tax" },
  { rank: "2", name: "Priya Nair", style: "Options flow", score: "88", proof: "Tax" },
  { rank: "3", name: "Marcus Chen", style: "Stat-arb · ETFs", score: "84", proof: "Stmt" },
  { rank: "4", name: "Diego Santos", style: "Macro · FX/rates", score: "79", proof: "Stmt" },
];

function LeaderboardPanel() {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Verified traders</p>
        <span className="text-xs text-slate-500">by research score</span>
      </div>
      <ul className="mt-3 divide-y divide-slate-800">
        {LEADERS.map((l) => (
          <li key={l.rank} className="flex items-center gap-3 py-2.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tabular-nums text-slate-300">
              {l.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{l.name}</p>
              <p className="truncate text-xs text-slate-500">{l.style}</p>
            </div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
              {l.proof}
            </span>
            <span className="w-7 text-right text-sm font-semibold tabular-nums text-white">{l.score}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DiligencePanel() {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <p className="text-sm font-medium text-white">Diligence brief</p>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          Constructive record
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" /> Strengths
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
            <li>Controlled drawdown</li>
            <li>Tax-record verified</li>
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-300">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Risk flags
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
            <li>Big-win dependency</li>
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-cyan-300">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Monitor
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
            <li>Concentration</li>
            <li>Recovery speed</li>
          </ul>
        </div>
      </div>
      <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-500">
        A summary of past performance — not investment advice or an allocation recommendation.
      </p>
    </Panel>
  );
}
