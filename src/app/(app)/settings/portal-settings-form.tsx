"use client";

import { useActionState } from "react";
import { savePortalSettings } from "./actions";
import { btnPrimary, inputClass } from "@/components/form";

const CADENCE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "DAILY", label: "Daily", hint: "Fresh for 48 hours" },
  { value: "WEEKLY", label: "Weekly", hint: "Fresh for 9 days" },
  { value: "MONTHLY", label: "Monthly", hint: "Fresh for 40 days" },
  { value: "MANUAL", label: "Manual", hint: "No fixed schedule" },
];

export function PortalSettingsForm({
  slug,
  isPublic,
  hideAmounts,
  hideBrokers,
  updateCadence,
  disclaimer,
}: {
  slug: string;
  isPublic: boolean;
  hideAmounts: boolean;
  hideBrokers: boolean;
  updateCadence: string;
  disclaimer: string;
}) {
  const [state, action, pending] = useActionState(savePortalSettings, undefined);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-500">
        Your research profile: <span className="font-mono text-slate-300">/p/{slug}</span>
      </p>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-slate-700">Public profile</span>
          <span className="block text-xs text-slate-500">
            Anyone with the link can view your research profile.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="hideAmounts" defaultChecked={hideAmounts} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-slate-700">Hide dollar amounts</span>
          <span className="block text-xs text-slate-500">
            Show percentages and scores on the public card, but redact exact $ figures.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="hideBrokers" defaultChecked={hideBrokers} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-slate-700">Hide broker &amp; account names</span>
          <span className="block text-xs text-slate-500">
            Redact broker and account labels in the public breakdown. Performance metrics are
            unchanged; only the private labels are hidden.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="updateCadence" className="text-sm font-medium text-slate-700">
          Update cadence
        </label>
        <p className="text-xs text-slate-500">
          How often you commit to refreshing this profile. The public card shows a freshness badge
          based on this; it does not auto-publish anything.
        </p>
        <select
          id="updateCadence"
          name="updateCadence"
          defaultValue={updateCadence}
          className={inputClass}
        >
          {CADENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} - {o.hint}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="disclaimer" className="text-sm font-medium text-slate-700">
          Disclaimer <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="disclaimer"
          name="disclaimer"
          rows={3}
          defaultValue={disclaimer}
          placeholder="Leave blank to use the default Quant Connect disclaimer."
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving..." : "Save settings"}
        </button>
        {state?.saved && <span className="text-sm text-emerald-600">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
