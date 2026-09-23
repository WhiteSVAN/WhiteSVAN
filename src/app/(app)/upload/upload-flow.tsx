"use client";

import { type ChangeEvent, useActionState, useMemo, useState } from "react";
import {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  autoMap,
  parseTradesCsv,
  type CanonicalField,
  type ColumnMapping,
  type ParseResult,
} from "@/lib/csv/parse";
import {
  BROKER_FORMATS,
  brokerForFormat,
  detectBrokerFormat,
  parseBrokerCsv,
  type BrokerParseResult,
} from "@/lib/csv/brokers";
import { confirmImport, createAccount } from "./actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

const FIELD_LABELS: Record<CanonicalField, string> = {
  tradeDate: "Trade date",
  symbol: "Symbol",
  assetType: "Asset type",
  side: "Side",
  quantity: "Quantity",
  entryPrice: "Entry price",
  exitPrice: "Exit price",
  realizedPnl: "Realized P&L",
  fees: "Fees",
  accountName: "Account name",
};

const REQUIRED = new Set<CanonicalField>(REQUIRED_FIELDS);

interface Account {
  id: string;
  accountName: string;
}

/** A broker FIFO result also satisfies the preview's needs (trades + errors). */
type PreviewResult = ParseResult | BrokerParseResult;
const isBrokerResult = (r: PreviewResult): r is BrokerParseResult => "fills" in r;

export function UploadFlow({
  accounts,
  selectedAccountId,
}: {
  accounts: Account[];
  selectedAccountId?: string;
}) {
  const [state, action, pending] = useActionState(confirmImport, undefined);
  const [createState, createAccountAction, creating] = useActionState(createAccount, undefined);
  const initialAccount =
    (selectedAccountId && accounts.some((a) => a.id === selectedAccountId)
      ? selectedAccountId
      : accounts[0]?.id) ?? "";
  const [accountId, setAccountId] = useState(initialAccount);
  const [addingAccount, setAddingAccount] = useState(false);
  const [format, setFormat] = useState("auto");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const isAuto = format === "auto";

  /** Auto-detect path needs the column headers + a default mapping. */
  function refreshAutoMapping(text: string) {
    const parsed = parseTradesCsv(text, {});
    setHeaders(parsed.headers);
    setMapping(autoMap(parsed.headers));
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);

    // If the user left it on auto-detect, try to recognize the broker for them.
    let fmt = format;
    if (format === "auto") {
      const detected = detectBrokerFormat(text);
      if (detected) {
        fmt = detected;
        setFormat(detected);
      }
    }

    if (fmt === "auto") refreshAutoMapping(text);
    else setHeaders([]);
  }

  function onFormatChange(next: string) {
    setFormat(next);
    if (!csvText) return;
    if (next === "auto") refreshAutoMapping(csvText);
    else setHeaders([]);
  }

  const result = useMemo<PreviewResult | null>(() => {
    if (!csvText) return null;
    return isAuto ? parseTradesCsv(csvText, mapping) : parseBrokerCsv(format, csvText);
  }, [csvText, isAuto, format, mapping]);

  const missingRequired = isAuto
    ? CANONICAL_FIELDS.filter((f) => REQUIRED.has(f) && !mapping[f])
    : [];
  const canImport =
    !!accountId && !!result && result.trades.length > 0 && missingRequired.length === 0;

  return (
    <div className="space-y-5">
      {/* Broker source */}
      <div className="terminal-card p-4">
        <label htmlFor="format" className={labelClass}>
          Broker source
        </label>
        <select
          id="format"
          value={format}
          onChange={(e) => onFormatChange(e.target.value)}
          className={inputClass}
        >
          {BROKER_FORMATS.map((f) => (
            <option key={f.id} value={f.id} disabled={f.status === "soon"}>
              {f.label}
              {f.status === "soon" ? " (coming soon)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-zinc-500">
          Pick a supported broker source or leave detection on automatic. Direct read-only
          connections are the product direction; this bridge workflow loads broker-reported history
          while connectors are added.
        </p>
      </div>

      {/* Account + file */}
      <div className="terminal-card grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="account" className={labelClass}>
              Account
            </label>
            {!addingAccount && (
              <button
                type="button"
                onClick={() => setAddingAccount(true)}
                className="text-xs font-medium text-zinc-300 hover:text-zinc-200"
              >
                + New account
              </button>
            )}
          </div>

          {addingAccount ? (
            // Inline create — broker pre-filled from the chosen format above.
            <form
              action={createAccountAction}
              className="mt-1 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
            >
              <div>
                <input
                  name="accountName"
                  required
                  autoFocus
                  className={inputClass}
                  placeholder="Account name (e.g. Fidelity Individual)"
                />
                <FieldError messages={createState?.errors?.accountName} />
              </div>
              <input
                key={format}
                name="broker"
                defaultValue={brokerForFormat(format)}
                className={inputClass}
                placeholder="Broker (optional)"
              />
              <input
                name="startingBalance"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                placeholder="Starting balance (optional)"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-white disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingAccount(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="file" className={labelClass}>
            Broker statement/export file
          </label>
          <input
            id="file"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-800"
          />
          {fileName && <p className="mt-1 text-xs text-zinc-500">{fileName}</p>}
        </div>
      </div>

      {/* Column mapping — auto-detect path only, collapsed once recognized */}
      {isAuto && headers.length > 0 && (
        <div className="terminal-card p-4">
          <details open={missingRequired.length > 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
              {missingRequired.length === 0 ? (
                <>
                  <span className="text-zinc-100">✓</span>
                  <span className="font-medium text-zinc-800">
                    Columns matched from your source file
                  </span>
                  <span className="text-zinc-400">— click to review or adjust</span>
                </>
              ) : (
                <>
                  <span className="text-zinc-300">⚠</span>
                  <span className="font-medium text-zinc-800">Map columns</span>
                  <span className="text-zinc-400">
                    — still need: {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
                  </span>
                </>
              )}
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CANONICAL_FIELDS.map((field) => (
                <div key={field}>
                  <label className="text-xs font-medium text-zinc-600">
                    {FIELD_LABELS[field]}
                    {REQUIRED.has(field) && <span className="text-zinc-300"> *</span>}
                  </label>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                    }
                    className={inputClass}
                  >
                    <option value="">— none —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
          {!mapping.realizedPnl && (
            <p className="mt-3 text-xs text-zinc-500">
              No <strong>realized P&amp;L</strong> column found. If this is a Robinhood, Webull, or
              Fidelity <em>transaction</em> export, pick your broker above and TrustSVAN will pair
              buys/sells into closed trades for you.
            </p>
          )}
        </div>
      )}

      {/* FIFO summary — broker transaction-export path */}
      {!isAuto && result && isBrokerResult(result) && (
        <div className="terminal-card p-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-100">✓</span>
            <span className="font-medium text-zinc-800">Matched buys &amp; sells (FIFO)</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Paired <strong>{result.fills}</strong> fills into <strong>{result.matched}</strong>{" "}
            closed trades with realized P&amp;L.
            {result.openPositions > 0 && (
              <>
                {" "}
                <strong>{result.openPositions}</strong> position
                {result.openPositions === 1 ? "" : "s"} still open (no realized P&amp;L yet — they&apos;ll
                count once closed).
              </>
            )}
            {format === "webull" && " Webull omits commissions/fees, so fees show as $0."}
          </p>
        </div>
      )}

      {/* Preview */}
      {result && (
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-800">Broker history preview</h3>
            <span className="text-xs text-zinc-500">
              {result.trades.length} valid · {result.errors.length} skipped
            </span>
          </div>

          {result.trades.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-zinc-400">
                    <th className="py-1 pr-4 font-medium">Date</th>
                    <th className="py-1 pr-4 font-medium">Symbol</th>
                    <th className="py-1 pr-4 font-medium">Side</th>
                    <th className="py-1 pr-4 text-right font-medium">Qty</th>
                    <th className="py-1 pr-4 text-right font-medium">P&amp;L</th>
                    <th className="py-1 text-right font-medium">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(0, 8).map((t, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-1 pr-4 font-mono text-xs text-zinc-600">{t.tradeDate}</td>
                      <td className="py-1 pr-4">{t.symbol}</td>
                      <td className="py-1 pr-4 text-zinc-500">{t.side ?? "—"}</td>
                      <td className="py-1 pr-4 text-right">{t.quantity ?? "—"}</td>
                      <td
                        className={`py-1 pr-4 text-right tabular-nums ${
                          t.realizedPnl >= 0 ? "text-zinc-100" : "text-zinc-300"
                        }`}
                      >
                        {t.realizedPnl.toFixed(2)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-zinc-500">
                        {t.fees.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.trades.length > 8 && (
                <p className="mt-2 text-xs text-zinc-400">
                  + {result.trades.length - 8} more rows
                </p>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-300">
                {result.errors.length} rows skipped — why?
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                {result.errors.slice(0, 5).map((er, i) => (
                  <li key={i}>
                    Row {er.row}: {er.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Load source history */}
      <form action={action} className="space-y-3">
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="csvText" value={csvText} />
        <input type="hidden" name="fileName" value={fileName} />
        <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
        <FormError message={state?.message} />
        <button
          type="submit"
          disabled={!canImport || pending}
          className={`${btnPrimary} sm:w-auto sm:px-6`}
        >
          {pending
            ? "Loading..."
            : result && result.trades.length > 0
              ? `Load ${result.trades.length} trades`
              : "Load history"}
        </button>
      </form>
    </div>
  );
}
