import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  FileCheck2,
  FileSearch,
  GitCompareArrows,
  Layers,
  LineChart,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { ProofTerminal } from "@/components/landing/proof-terminal";
import { BrokerLogos } from "@/components/broker-logos";
import { SiteFooter } from "@/components/site-footer";

const PRINCIPLES = [
  ["01", "From the source.", "Evidence, not screenshots."],
  ["02", "Beyond the return.", "Risk belongs in the picture."],
  ["03", "Open to inspection.", "Context you can scrutinize."],
];

const OPERATORS = [
  { name: "Sofia Alvarez", initials: "SA", strategy: "Systematic futures", proof: "Tax checked", cagr: "+38.4%", sharpe: "2.10", drawdown: "5.8%" },
  { name: "Priya Nair", initials: "PN", strategy: "Options flow", proof: "Tax checked", cagr: "+31.7%", sharpe: "1.88", drawdown: "7.2%" },
  { name: "Marcus Chen", initials: "MC", strategy: "Statistical arbitrage", proof: "Statement checked", cagr: "+24.9%", sharpe: "1.72", drawdown: "8.6%" },
  { name: "Diego Santos", initials: "DS", strategy: "Global macro", proof: "Statement checked", cagr: "+19.6%", sharpe: "1.41", drawdown: "9.4%" },
];

const VERIFICATION = [
  {
    n: "01",
    title: "Connect the source.",
    subtitle: "Read-only access. Your trades stay yours.",
    body: "Start with broker history or an account export. TrustSVAN reads the record; it never executes trades or moves money.",
    icon: LockKeyhole,
  },
  {
    n: "02",
    title: "Build the evidence.",
    subtitle: "A proof level, not a promise.",
    body: "Statements and tax records strengthen the record while sensitive files remain under your control.",
    icon: ShieldCheck,
  },
  {
    n: "03",
    title: "Publish with context.",
    subtitle: "Make performance easier to inspect.",
    body: "Bring strategy, observation window, risk, freshness, and evidence together in one shareable profile.",
    icon: GitCompareArrows,
  },
];

const RESEARCH = [
  { icon: BarChart3, eyebrow: "Market structure", title: "Dealer positioning into expiry", body: "Gamma maps, assumptions, invalidation levels, and the source behind the read." },
  { icon: LineChart, eyebrow: "Systematic study", title: "The record beyond the backtest", body: "Rules, costs, out-of-sample behavior, drawdowns, and documented failure modes." },
  { icon: Layers, eyebrow: "Portfolio", title: "Concentration under the microscope", body: "Risk contribution, factor overlap, correlation shifts, and recovery behavior." },
  { icon: FileSearch, eyebrow: "Diligence", title: "A thesis with a counterview", body: "Evidence, assumptions, risks, and the next check—not alerts, hype, or promises." },
];

const FAQ = [
  ["Does TrustSVAN execute or copy trades?", "No. Connections are read-only. TrustSVAN is research, verification, and reporting software; it never places trades or moves funds."],
  ["What does a proof level mean?", "It describes the evidence attached to a record—from source history through statements and tax records. It is not a safety rating or a prediction."],
  ["Can operators keep account details private?", "Yes. Operators can hide amounts and broker names, keep evidence private, and decide whether their profile is public."],
  ["Are the numbers computed by AI?", "No. Metrics are calculated deterministically in code. AI can only draft narrative from already-computed values, behind compliance checks."],
];

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#baf277] px-5 text-sm font-medium text-[#17200e] shadow-sm hover:bg-[#cdf995]";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[#3a493d] bg-[#111813] px-5 text-sm font-medium text-[#e1e8db] hover:border-[#718462] hover:bg-[#1b261c]";

export default function Home() {
  return (
    <div id="top" className="min-h-full flex-1 overflow-clip bg-[#0b0f0d] text-[#f0f3ec]">
      <a href="#main" className="fixed -top-20 left-5 z-50 bg-[#baf277] px-4 py-3 text-sm font-medium text-[#17200e] focus:top-3">
        Skip to content
      </a>

      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#a2af9f]">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> The proof terminal</span>
          <span className="hidden sm:block">Source-backed records <span className="mx-3 text-[#5b695c]">/</span> Risk in context</span>
          <Link href="/login" className="flex items-center gap-2 hover:text-[#baf277]">Go to your app <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-[#202821] bg-[#0b0f0d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[86px] max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Link href="/" className="text-[22px]" aria-label="TrustSVAN home"><SvanLogo /></Link>
          <nav className="ml-auto hidden items-center gap-8 text-xs text-[#b5beb5] md:flex" aria-label="Main navigation">
            <Link href="#explore" className="hover:text-[#baf277]">Explore operators</Link>
            <Link href="#verification" className="hover:text-[#baf277]">Verification</Link>
            <Link href="#research" className="hover:text-[#baf277]">Research</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-8">
            <Link href="/login" className="hidden text-xs text-[#b5beb5] hover:text-[#baf277] sm:block">Sign in</Link>
            <Link href="/signup" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#baf277] px-4 text-xs font-medium text-[#17200e] hover:bg-[#cdf995]">
              Build your record <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="terminal-grid border-b border-[#202821]">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:py-24">
            <div className="qd-fade-up">
              <p className="terminal-label flex items-center gap-3"><span className="h-px w-6 bg-[#baf277]" /> Evidence over everything</p>
              <h1 className="mt-7 max-w-2xl text-[clamp(3.9rem,7vw,6.3rem)] font-medium leading-[0.98] tracking-[-0.065em] text-[#f0f3ec]">
                Less noise.<br />More <span className="text-[#baf277]">proof.</span>
              </h1>
              <p className="mt-7 text-lg tracking-[-0.02em] text-[#e4e9df]">Trading records, with the receipts attached.</p>
              <p className="mt-3 max-w-md text-sm leading-7 text-[#a0ada2]">
                Look beyond the headline return. Inspect the performance, understand the risk, and see the evidence behind the record.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/explore" className={primaryButton}>Explore operators <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/signup" className={secondaryButton}>Build your record <ArrowUpRight className="h-4 w-4" /></Link>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-[#8c9a8c]">
                <ShieldCheck className="h-4 w-4 text-[#b8d6a0]" />
                <span>Read-only by design.</span><span className="border-l border-[#364131] pl-2">No trade execution.</span>
              </div>
              <a href="#verification" className="mt-10 flex items-center gap-4 text-[11px] text-[#92a089] hover:text-[#baf277]">
                A different standard of trust <ArrowDown className="h-3.5 w-3.5" />
              </a>
            </div>
            <ProofTerminal />
          </div>
        </section>

        <section className="border-b border-[#202821]">
          <div className="mx-auto grid max-w-7xl gap-px bg-[#202821] sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map(([number, title, body]) => (
              <div key={number} className="flex gap-4 bg-[#0b0f0d] px-6 py-7">
                <span className="font-mono text-[10px] text-[#94a388]">{number}</span>
                <div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs text-[#879487]">{body}</p></div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-[#101611] px-6 py-7 text-xs text-[#a4b09f] sm:col-span-2 lg:col-span-1">
              <LockKeyhole className="h-5 w-5 text-[#baf277]" /><span>Your account.<br /><strong className="font-medium text-[#dfe8d8]">Your control.</strong></span>
            </div>
          </div>
        </section>

        <section id="explore" className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="01 / Discovery, with context" title={<>Inspect the record.<br /><span>Not the follower count.</span></>} body="Different strategies. One standard of transparency. Explore the live directory to review proof, performance, freshness, and risk." />
          <div className="mt-10 overflow-hidden rounded-lg border border-[#2d382f] bg-[#101511]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d382f] px-5 py-4">
              <div className="flex items-center gap-5 text-xs"><span className="border-b border-[#baf277] pb-4 text-[#e1e9dc]">Operator preview <b className="ml-1 font-mono text-[#baf277]">04</b></span></div>
              <span className="terminal-label flex items-center gap-2"><i className="terminal-dot" /> Illustrative records</span>
            </div>
            <div className="hidden grid-cols-[2fr_1.3fr_.7fr_.7fr_1fr_auto] gap-4 border-b border-[#2d382f] px-5 py-3 font-mono text-[8px] uppercase tracking-wider text-[#758174] md:grid">
              <span>Operator / strategy</span><span>Proof level</span><span>CAGR</span><span>Sharpe</span><span>Max drawdown</span><span>Inspect</span>
            </div>
            {OPERATORS.map((operator) => (
              <article key={operator.name} className="grid gap-4 border-b border-[#263029] px-5 py-4 last:border-0 hover:bg-[#151d17] md:grid-cols-[2fr_1.3fr_.7fr_.7fr_1fr_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#4d603c] bg-[#23321c] font-mono text-[10px] text-[#cce1b6]">{operator.initials}</span>
                  <div><h3 className="text-sm font-medium text-[#e8eee3]">{operator.name}</h3><p className="mt-1 text-[10px] text-[#849083]">{operator.strategy}</p></div>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded border border-[#57733a] bg-[#1a2418] px-2 py-1 text-[9px] text-[#bdd69e]"><ShieldCheck className="h-3 w-3" />{operator.proof}</span>
                <Metric mobile="CAGR" value={operator.cagr} accent />
                <Metric mobile="Sharpe" value={operator.sharpe} />
                <Metric mobile="Drawdown" value={operator.drawdown} />
                <Link href="/explore" className="flex w-fit items-center gap-1 text-xs text-[#b7ce99] hover:text-[#baf277]">View <ArrowRight className="h-3 w-3" /></Link>
              </article>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2d382f] px-5 py-4 text-[10px] text-[#849083]">
              <span>Public profiles use published snapshots—not live private account data.</span>
              <Link href="/explore" className="inline-flex items-center gap-2 font-medium text-[#c1d8a3] hover:text-[#baf277]">Open live directory <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </section>

        <section id="verification" className="border-y border-[#202821] bg-[#0e1410]">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="terminal-label">02 / Trust has a paper trail</p>
              <h2 className="mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Proof is a process.<br /><span className="text-[#84947d]">Not a badge you buy.</span></h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#9ca99d]">Each level says what evidence supports the record—and just as importantly, what has not been checked.</p>
              <Link href="/signup" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#bcd69d] hover:text-[#baf277]">Start your record <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ol className="divide-y divide-[#2d382f] border-y border-[#2d382f]">
              {VERIFICATION.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.n} className="grid gap-4 py-6 sm:grid-cols-[42px_1fr_auto] sm:items-start">
                    <span className="font-mono text-[10px] text-[#91a186]">{step.n}</span>
                    <div><h3 className="text-lg font-medium text-[#e9efe4]">{step.title}</h3><p className="mt-1 text-xs font-medium text-[#bdc9b5]">{step.subtitle}</p><p className="mt-3 max-w-xl text-sm leading-6 text-[#8e9b90]">{step.body}</p></div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#42523e] bg-[#151d16] text-[#baf277]"><Icon className="h-5 w-5" /></span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="research" className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="03 / Research, built to be challenged" title={<>A thesis with sources.<br /><span>A risk with a name.</span></>} body="Structured research keeps the evidence, assumptions, counterview, and invalidation in the same place." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {RESEARCH.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group relative overflow-hidden rounded-lg border border-[#2b362e] bg-[#101611] p-6 hover:border-[#526544]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#baf277]/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-center justify-between"><span className="terminal-label">{item.eyebrow}</span><span className="font-mono text-[9px] text-[#6f7c70]">0{index + 1}</span></div>
                  <Icon className="mt-8 h-7 w-7 text-[#baf277]" />
                  <h3 className="mt-6 text-xl font-medium tracking-[-0.02em] text-[#e8eee3]">{item.title}</h3>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[#8f9c91]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-[#202821] bg-[#0e1410]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div><p className="terminal-label">04 / Common questions</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.05em]">Understand<br /><span className="text-[#899687]">the standard.</span></h2></div>
            <div className="divide-y divide-[#2d382f] border-y border-[#2d382f]">
              {FAQ.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="flex list-none items-center justify-between gap-4 text-sm font-medium text-[#dfe7da] marker:hidden">
                    {question}<span className="font-mono text-lg font-normal text-[#91a287] group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#929f94]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="terminal-grid relative overflow-hidden rounded-xl border border-[#405139] bg-[#111812] px-6 py-14 text-center sm:px-12 sm:py-20">
            <div className="proof-ambient pointer-events-none absolute inset-0" />
            <FileCheck2 className="relative mx-auto h-8 w-8 text-[#baf277]" />
            <h2 className="relative mt-6 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">Less claiming.<br /><span className="text-[#baf277]">More proving.</span></h2>
            <p className="relative mx-auto mt-5 max-w-xl text-sm leading-7 text-[#9ba89d]">Build the record serious clients, firms, collaborators, and allocators can inspect.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className={primaryButton}>Build your record <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/explore" className={secondaryButton}>Explore operators</Link>
            </div>
            <p className="relative mt-6 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#7e8c7d]"><Check className="h-3 w-3" /> Past performance does not guarantee future results</p>
          </div>
        </section>
      </main>

      <section className="border-t border-[#202821] bg-[#0e1410] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-8"><p className="text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[#778379]">Connect history from the broker or prop firm you already use</p><div className="mt-6 opacity-80"><BrokerLogos /></div></div>
      </section>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_.7fr] md:items-end">
      <div><p className="terminal-label">{eyebrow}</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">{title}</h2></div>
      <p className="max-w-lg text-sm leading-7 text-[#929f94] md:justify-self-end">{body}</p>
    </div>
  );
}

function Metric({ mobile, value, accent = false }: { mobile: string; value: string; accent?: boolean }) {
  return (
    <div><span className="mr-2 font-mono text-[8px] uppercase text-[#6f7c70] md:hidden">{mobile}</span><strong className={`font-mono text-xs font-normal ${accent ? "text-[#baf277]" : "text-[#d4ddd0]"}`}>{value}</strong></div>
  );
}
