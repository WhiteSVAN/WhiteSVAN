/**
 * Broker integration wall for the landing page — the "works with your broker"
 * trust signal (à la verified-trading networks).
 *
 * These are styled name wordmarks, not the brokers' trademarked logo art: it
 * conveys breadth of coverage without shipping anyone's brand assets. To swap in
 * real SVG logos later, replace the chip body with an <Image>/<svg> per entry —
 * the list below is the single source of truth, so "add a broker" = add a line.
 *
 * Import coverage today is via CSV/statement export (IBKR Flex, Fidelity and
 * E*TRADE realized-gain exports, manual template); the rest are on the roadmap.
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
          className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-center text-sm font-semibold tracking-tight text-slate-400 grayscale transition hover:border-cyan-400/40 hover:text-slate-100 hover:grayscale-0"
        >
          {name}
        </div>
      ))}
    </div>
  );
}
