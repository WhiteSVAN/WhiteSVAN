/**
 * File-export formats currently supported by the importer.
 *
 * These are styled name wordmarks, not the brokers' trademarked logo art: it
 * conveys breadth of coverage without shipping anyone's brand assets. To swap in
 * real SVG logos later, replace the chip body with an <Image>/<svg> per entry —
 * the list below is the single source of truth, so "add a broker" = add a line.
 *
 * These labels describe import-format support, not direct broker connections.
 */
const BROKERS = ["Interactive Brokers", "Fidelity", "E*TRADE", "Webull"];

export function BrokerLogos() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BROKERS.map((name) => (
        <div
          key={name}
          className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-4 text-center text-sm font-semibold text-zinc-400 grayscale transition hover:border-zinc-500/50 hover:text-zinc-100 hover:grayscale-0"
        >
          {name}
        </div>
      ))}
    </div>
  );
}
