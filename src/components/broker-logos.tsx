/**
 * Broker integration wall for the landing page — the "works with your broker"
 * trust signal (à la verified-trading networks).
 *
 * These are styled name wordmarks, not the brokers' trademarked logo art: it
 * conveys breadth of coverage without shipping anyone's brand assets. To swap in
 * real SVG logos later, replace the chip body with an <Image>/<svg> per entry —
 * the list below is the single source of truth, so "add a broker" = add a line.
 *
 * Product coverage is framed around read-only broker and prop-firm connections.
 * While direct connectors are added, source files and statements can feed the
 * same proof model without changing public profile semantics.
 */
const BROKERS = [
  "Interactive Brokers",
  "Fidelity",
  "Charles Schwab",
  "E*TRADE",
  "Robinhood",
  "Webull",
  "TD Ameritrade",
  "tastytrade",
  "thinkorswim",
  "TradeStation",
  "NinjaTrader",
  "Tradovate",
  "Lightspeed",
  "Topstep",
];

export function BrokerLogos() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {BROKERS.map((name) => (
        <div
          key={name}
          className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-4 text-center text-sm font-semibold tracking-tight text-zinc-400 grayscale transition hover:border-zinc-500/50 hover:text-zinc-100 hover:grayscale-0"
        >
          {name}
        </div>
      ))}
    </div>
  );
}
