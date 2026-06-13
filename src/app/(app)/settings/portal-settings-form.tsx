"use client";

import { useActionState } from "react";
import { savePortalSettings } from "./actions";
import { btnPrimary, inputClass } from "@/components/form";

export function PortalSettingsForm({
  slug,
  isPublic,
  hideAmounts,
  disclaimer,
}: {
  slug: string;
  isPublic: boolean;
  hideAmounts: boolean;
  disclaimer: string;
}) {
  const [state, action, pending] = useActionState(savePortalSettings, undefined);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-500">
        Your portal: <span className="font-mono text-slate-700">/p/{slug}</span>
      </p>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-slate-700">Public</span>
          <span className="block text-xs text-slate-500">
            Anyone with the link can view your portal.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="hideAmounts" defaultChecked={hideAmounts} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-slate-700">Hide dollar amounts</span>
          <span className="block text-xs text-slate-500">
            Show percentages and scores on the public portal, but redact exact $ figures.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="disclaimer" className="text-sm font-medium text-slate-700">
          Disclaimer <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="disclaimer"
          name="disclaimer"
          rows={3}
          defaultValue={disclaimer}
          placeholder="Leave blank to use the default TrustSVAN disclaimer."
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state?.saved && <span className="text-sm text-emerald-600">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
