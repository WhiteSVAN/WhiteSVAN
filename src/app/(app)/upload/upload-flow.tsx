"use client";

import { type ChangeEvent, useActionState, useMemo, useState } from "react";
import {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  detectPreset,
  parseTradesCsv,
  type CanonicalField,
  type ColumnMapping,
} from "@/lib/csv/parse";
import { confirmImport } from "./actions";
import { btnPrimary, FormError, inputClass, labelClass } from "@/components/form";

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

export function UploadFlow({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState(confirmImport, undefined);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTradesCsv(text, {});
    setFileName(file.name);
    setCsvText(text);
    setHeaders(parsed.headers);
    setMapping(detectPreset(parsed.headers)?.mapping ?? {});
  }

  const result = useMemo(
    () => (csvText ? parseTradesCsv(csvText, mapping) : null),
    [csvText, mapping],
  );

  const missingRequired = CANONICAL_FIELDS.filter((f) => REQUIRED.has(f) && !mapping[f]);
  const canImport =
    !!accountId && !!result && result.trades.length > 0 && missingRequired.length === 0;

  return (
    <div className="space-y-5">
      {/* Account + file */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="account" className={labelClass}>
            Account
          </label>
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
        </div>
        <div>
          <label htmlFor="file" className={labelClass}>
            CSV file
          </label>
          <input
            id="file"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {fileName && <p className="mt-1 text-xs text-slate-500">{fileName}</p>}
        </div>
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium text-slate-800">Map columns</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            We auto-detected what we could. Required fields are marked
            <span className="text-red-500"> *</span>.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {CANONICAL_FIELDS.map((field) => (
              <div key={field}>
                <label className="text-xs font-medium text-slate-600">
                  {FIELD_LABELS[field]}
                  {REQUIRED.has(field) && <span className="text-red-500"> *</span>}
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
          {missingRequired.length > 0 && (
            <p className="mt-3 text-xs text-amber-600">
              Map these required fields: {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800">Preview</h3>
            <span className="text-xs text-slate-500">
              {result.trades.length} valid · {result.errors.length} skipped
            </span>
          </div>

          {result.trades.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
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
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-4 font-mono text-xs text-slate-600">{t.tradeDate}</td>
                      <td className="py-1 pr-4">{t.symbol}</td>
                      <td className="py-1 pr-4 text-slate-500">{t.side ?? "—"}</td>
                      <td className="py-1 pr-4 text-right">{t.quantity ?? "—"}</td>
                      <td
                        className={`py-1 pr-4 text-right tabular-nums ${
                          t.realizedPnl >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {t.realizedPnl.toFixed(2)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-slate-500">
                        {t.fees.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.trades.length > 8 && (
                <p className="mt-2 text-xs text-slate-400">
                  + {result.trades.length - 8} more rows
                </p>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-amber-600">
                {result.errors.length} rows skipped — why?
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
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

      {/* Import */}
      <form action={action} className="space-y-3">
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="csvText" value={csvText} />
        <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
        <FormError message={state?.message} />
        <button
          type="submit"
          disabled={!canImport || pending}
          className={`${btnPrimary} sm:w-auto sm:px-6`}
        >
          {pending
            ? "Importing…"
            : result && result.trades.length > 0
              ? `Import ${result.trades.length} trades`
              : "Import"}
        </button>
      </form>
    </div>
  );
}
