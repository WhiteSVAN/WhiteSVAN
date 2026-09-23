import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Database,
  Info,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { SiteFooter } from "@/components/site-footer";
import { EXAMPLE_OPERATORS, findExampleOperator } from "@/lib/example-operators";

export function generateStaticParams() {
  return EXAMPLE_OPERATORS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const operator = findExampleOperator(slug);
  return {
    title: operator ? `${operator.displayName} — Example record` : "Example record — TrustSVAN",
    description: operator?.summary,
    robots: { index: false },
  };
}

export default async function ExampleOperatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const operator = findExampleOperator(slug);
  if (!operator) notFound();

  return (
    <div className="min-h-full bg-[#0b0f0d] text-[#f0f3ec]">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#9aa698]">
        <div className="mx-auto flex h-8 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> Illustrative operator record</span>
          <span className="hidden sm:block">Fictional data / product demonstration</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-[#202821] bg-[#0b0f0d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link href="/" aria-label="TrustSVAN home" className="text-xl"><SvanLogo /></Link>
          <Link href="/explore" className="inline-flex items-center gap-2 text-xs text-[#aab6aa] hover:text-[#baf277]"><ArrowLeft className="h-3.5 w-3.5" /> All records</Link>
        </div>
      </header>

      <main>
        <section className="terminal-grid border-b border-[#202821]">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#536b40] bg-[#26391d] font-mono text-sm text-[#d8e8c5]">{operator.initials}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-5xl">{operator.displayName}</h1>
                    <span className="rounded border border-[#4a5647] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-[#98a693]">Example</span>
                  </div>
                  <p className="mt-2 text-sm text-[#9ca99d]">{operator.location} · {operator.strategy} · {operator.instruments}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md border border-[#5a763e] bg-[#1b2818] px-3 py-2 text-[10px] text-[#c5dfa7]"><ShieldCheck className="h-4 w-4" /> {operator.proof}</span>
            </div>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-[#d8dfd3]">{operator.summary}</p>
          </div>
        </section>

        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1.35fr_.65fr] lg:py-12">
          <div className="space-y-6">
            <section className="terminal-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e382a] px-5 py-4">
                <div><p className="terminal-label">Illustrative performance context</p><h2 className="mt-1 text-lg font-medium">Published observation window</h2></div>
                <span className="font-mono text-[10px] text-[#91a088]">{operator.trackRecord}</span>
              </div>
              <div className="p-5 sm:p-6">
                <EquityLine values={operator.equity} />
                <div className="mt-6 grid grid-cols-3 border-t border-[#2d392d] pt-5">
                  <RecordMetric label="Return" value={`+${operator.returnPct.toFixed(1)}%`} accent />
                  <RecordMetric label="Sharpe" value={operator.sharpe.toFixed(2)} bordered />
                  <RecordMetric label="Max drawdown" value={`${operator.maxDrawdownPct.toFixed(1)}%`} bordered />
                </div>
              </div>
            </section>

            <section className="grid gap-px overflow-hidden rounded-lg border border-[#2b362e] bg-[#2b362e] sm:grid-cols-3">
              <ContextCard icon={Scale} label="Observed capital" value={operator.capitalBand} />
              <ContextCard icon={Clock3} label="Record length" value={operator.trackRecord} />
              <ContextCard icon={Database} label="Record freshness" value={operator.freshness} />
            </section>

            <section className="rounded-lg border border-[#2b362e] bg-[#101611] p-6">
              <p className="terminal-label">Process under inspection</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {operator.process.map((item, index) => <div key={item} className="border-t border-[#344034] pt-4"><span className="font-mono text-[9px] text-[#7f8f79]">0{index + 1}</span><p className="mt-2 text-xs leading-5 text-[#c4cec0]">{item}</p></div>)}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-[#384433] bg-[#121912] p-5">
              <p className="terminal-label">Capacity context</p>
              <strong className="mt-3 block font-mono text-2xl font-normal text-[#e5ebdf]">{operator.capitalBand}</strong>
              <p className="mt-3 text-xs leading-6 text-[#98a494]">{operator.capacityNote}</p>
              <div className="mt-4 border-t border-[#303b31] pt-4 text-[10px] text-[#869383]">Risk budget · <span className="text-[#c2cec0]">{operator.riskBudget}</span></div>
            </section>

            <RecordList title="Evidence attached" icon={Check} items={operator.evidence} />
            <RecordList title="What still needs scrutiny" icon={Info} items={operator.riskNotes} warning />
          </aside>
        </div>

        <section className="border-y border-[#202821] bg-[#0e1410]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6 px-4 py-10 sm:px-8">
            <div><p className="terminal-label">This is an example, not an endorsement</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.035em]">Build a record from your own source data.</h2></div>
            <Link href="/signup" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#baf277] px-5 text-sm font-medium text-[#17200e] hover:bg-[#cdf995]">Build your record <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function EquityLine({ values }: { values: number[] }) {
  const width = 720;
  const height = 210;
  const pad = 8;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (value - min) / (max - min)) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const area = `${line} L${points.at(-1)?.[0]} ${height} L${points[0][0]} ${height} Z`;
  return <div><div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-[#829079]"><span>Indexed equity · start = 100</span><span>Illustrative</span></div><svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-48 w-full" preserveAspectRatio="none" role="img" aria-label="Illustrative equity curve"><defs><linearGradient id="example-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#baf277" stopOpacity=".18" /><stop offset="100%" stopColor="#baf277" stopOpacity="0" /></linearGradient></defs>{[52, 104, 156].map((y) => <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="#27312d" strokeDasharray="4 7" />)}<path d={area} fill="url(#example-area)" /><path d={line} className="proof-chart-line" vectorEffect="non-scaling-stroke" /></svg></div>;
}

function RecordMetric({ label, value, accent = false, bordered = false }: { label: string; value: string; accent?: boolean; bordered?: boolean }) {
  return <div className={`px-4 first:pl-0 ${bordered ? "border-l border-[#334033]" : ""}`}><span className="font-mono text-[8px] uppercase tracking-wider text-[#758276]">{label}</span><strong className={`mt-2 block font-mono text-base font-normal sm:text-xl ${accent ? "text-[#baf277]" : "text-[#e1e7dd]"}`}>{value}</strong></div>;
}

function ContextCard({ icon: Icon, label, value }: { icon: typeof Scale; label: string; value: string }) {
  return <div className="bg-[#101611] p-5"><Icon className="h-4 w-4 text-[#baf277]" /><span className="mt-5 block font-mono text-[8px] uppercase tracking-wider text-[#748078]">{label}</span><strong className="mt-1 block text-sm font-medium text-[#dce4d7]">{value}</strong></div>;
}

function RecordList({ title, icon: Icon, items, warning = false }: { title: string; icon: typeof Check; items: string[]; warning?: boolean }) {
  return <section className="rounded-lg border border-[#2b362e] bg-[#101611] p-5"><h2 className="text-sm font-medium text-[#e0e7db]">{title}</h2><ul className="mt-4 space-y-3">{items.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-[#95a196]"><Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${warning ? "text-[#d8c899]" : "text-[#baf277]"}`} />{item}</li>)}</ul></section>;
}
