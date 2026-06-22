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
  openToWork,
  headline,
  services,
  contactUrl,
}: {
  slug: string;
  isPublic: boolean;
  hideAmounts: boolean;
  hideBrokers: boolean;
  updateCadence: string;
  disclaimer: string;
  openToWork: boolean;
  headline: string;
  services: string;
  contactUrl: string;
}) {
  const [state, action, pending] = useActionState(savePortalSettings, undefined);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-zinc-500">
        Your research profile: <span className="font-mono text-zinc-300">/p/{slug}</span>
      </p>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-zinc-700">Public profile</span>
          <span className="block text-xs text-zinc-500">
            Anyone with the link can view your research profile.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="hideAmounts" defaultChecked={hideAmounts} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-zinc-700">Hide dollar amounts</span>
          <span className="block text-xs text-zinc-500">
            Show percentages and scores on the public card, but redact exact $ figures.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="hideBrokers" defaultChecked={hideBrokers} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-zinc-700">Hide broker &amp; account names</span>
          <span className="block text-xs text-zinc-500">
            Redact broker and account labels in the public breakdown. Performance metrics are
            unchanged; only the private labels are hidden.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="updateCadence" className="text-sm font-medium text-zinc-700">
          Update cadence
        </label>
        <p className="text-xs text-zinc-500">
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

      <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <div>
          <p className="text-sm font-medium text-zinc-700">Work &amp; availability</p>
          <p className="text-xs text-zinc-500">
            Let allocators, prop firms, and clients know you&apos;re open to work and how to reach
            you. Shown on your public operator card and in the directory.
          </p>
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" name="openToWork" defaultChecked={openToWork} className="mt-1" />
          <span>
            <span className="text-sm font-medium text-zinc-700">Open to work</span>
            <span className="block text-xs text-zinc-500">
              Adds an &ldquo;Open to work&rdquo; badge and a contact button to your public card.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="headline" className="text-sm font-medium text-zinc-700">
            Headline <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="headline"
            name="headline"
            type="text"
            maxLength={140}
            defaultValue={headline}
            placeholder="Systematic futures trader · 3y verified track record"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="services" className="text-sm font-medium text-zinc-700">
            What you offer <span className="text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="services"
            name="services"
            rows={2}
            maxLength={600}
            defaultValue={services}
            placeholder="Managed research, strategy consulting, prop-firm evaluations…"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contactUrl" className="text-sm font-medium text-zinc-700">
            Contact link <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="contactUrl"
            name="contactUrl"
            type="text"
            defaultValue={contactUrl}
            placeholder="you@email.com, cal.com/you, or https://…"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            An email or link you control. We never expose your sign-in email.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="disclaimer" className="text-sm font-medium text-zinc-700">
          Disclaimer <span className="text-zinc-400">(optional)</span>
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
          {pending ? "Saving..." : "Save settings"}
        </button>
        {state?.saved && <span className="text-sm text-emerald-600">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
