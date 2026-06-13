import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";

const QUESTIONS = [
  { q: "Did they make money?", a: "Total result and growth rate, in plain dollars and percent — not jargon." },
  { q: "How painful was the risk?", a: "Biggest drop, with a clear severity label, plus how long recovery took." },
  { q: "Can I trust the data?", a: "A Proof Level shows where the numbers came from — CSV, statement, or verified." },
];

const STEPS = [
  { n: "1", t: "Upload your history", d: "Upload a broker or prop-firm CSV. IBKR and other formats are detected automatically — no manual mapping." },
  { n: "2", t: "Review your dashboard", d: "An equity curve, risk analytics, and an AI-written monthly report that you review and approve." },
  { n: "3", t: "Share a private portal", d: "A clean, read-only link for clients and allocators. Print or save it as a PDF in one click." },
];

const PRICING = [
  { name: "Free beta", price: "$0", blurb: "1 account, CSV upload, public dashboard" },
  { name: "Pro Trader", price: "$49", blurb: "Private portal, AI monthly report, PDF export" },
  { name: "Emerging Manager", price: "$199", blurb: "Multiple accounts, report archive, branding" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Trust<span className="text-blue-700">SVAN</span>
          </span>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/explore" className="text-slate-600 hover:text-slate-900">
              Explore
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-800"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 py-20">
          <p className="text-sm font-medium text-blue-700">Trust infrastructure for traders</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Turn your trading history into an investor-ready client portal.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Upload your broker or prop-firm CSV. TrustSVAN generates verified performance dashboards,
            risk analytics, AI monthly reports, and a private client link — in minutes.
          </p>

          <div className="mt-8">
            <WaitlistForm />
            <p className="mt-3 text-sm text-slate-500">
              Or{" "}
              <Link href="/signup" className="font-medium text-blue-700 hover:text-blue-800">
                create your account
              </Link>{" "}
              ·{" "}
              <Link href="/p/demo" className="font-medium text-blue-700 hover:text-blue-800">
                see a live demo portal →
              </Link>
            </p>
          </div>

          <ul className="mt-10 space-y-2">
            {[
              "Verified performance reports, without the spreadsheets",
              "AI-written risk and discipline summaries for your clients",
              "A private, shareable link for clients, allocators, and followers",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-blue-700">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* 30 seconds */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Clients understand it in 30 seconds
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              No trader terminal. A trust report anyone can read.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {QUESTIONS.map((c) => (
                <div key={c.q} className="rounded-xl border border-slate-200 p-5">
                  <p className="font-medium text-slate-900">{c.q}</p>
                  <p className="mt-1 text-sm text-slate-600">{c.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">
                  {s.n}
                </span>
                <h3 className="mt-3 font-medium text-slate-900">{s.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two audiences */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-medium text-slate-900">Client view</h3>
              <p className="mt-1 text-sm text-slate-600">
                Plain-English verdict, biggest-drop severity, and a TrustSVAN Transparency Score —
                built for clients with no finance background.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-medium text-slate-900">Trader view</h3>
              <p className="mt-1 text-sm text-slate-600">
                Equity curve, profit factor, drawdown, and risk flags — the raw metrics experienced
                traders use to review each other.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Simple pricing</h2>
          <p className="mt-1 text-sm text-slate-500">Free during the beta.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {PRICING.map((p) => (
              <div key={p.name} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">{p.name}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {p.price}
                  <span className="text-sm font-normal text-slate-400">/mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">{p.blurb}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-400">
          TrustSVAN is reporting and analytics software. It does not manage money, execute trades,
          provide investment advice, or guarantee performance. Past performance does not guarantee
          future results.
        </div>
      </footer>
    </div>
  );
}
