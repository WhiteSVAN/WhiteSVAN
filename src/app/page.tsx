import Link from "next/link";

const BULLETS = [
  "Verified-looking performance reports without spreadsheets",
  "AI risk and discipline recaps for clients",
  "Private share link for serious followers, clients, and allocators",
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

      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-4 py-16">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Turn your trading history into an investor-ready client portal.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Upload your broker or prop-firm CSV. TrustSVAN generates verified performance
          dashboards, risk analytics, AI monthly reports, and a private client link in minutes.
        </p>

        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-flex rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
          >
            Join the beta
          </Link>
        </div>

        <ul className="mt-10 space-y-2">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-blue-700">✓</span>
              {b}
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-400">
          TrustSVAN is reporting and analytics software. It does not manage money, execute
          trades, provide investment advice, or guarantee performance.
        </div>
      </footer>
    </div>
  );
}
