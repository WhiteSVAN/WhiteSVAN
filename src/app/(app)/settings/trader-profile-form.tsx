"use client";

import { useActionState } from "react";
import { saveTraderProfile } from "./actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";
import { TraderDetailFields } from "@/components/profile/detail-fields";
import type { TraderDetails } from "@/lib/profile-details";

export interface TraderProfileDefaults {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  strategy: string;
  instruments: string;
  riskRules: string;
  details: TraderDetails;
}

/** Public identity + structured fields. The handle is shown read-only. */
export function TraderProfileForm({ defaults }: { defaults: TraderProfileDefaults }) {
  const [state, action, pending] = useActionState(saveTraderProfile, undefined);
  const errors = state?.errors;

  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={80}
            defaultValue={defaults.displayName}
            className={inputClass}
          />
          <FieldError messages={errors?.displayName} />
        </div>
        <div>
          <p className={labelClass} id="slug-label">
            Public handle
          </p>
          <p
            aria-labelledby="slug-label"
            className="mt-2 flex min-h-11 items-center truncate rounded-md border border-zinc-800 bg-zinc-950/60 px-3 font-mono text-sm text-zinc-400"
          >
            /p/{defaults.slug}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Handles can&apos;t be changed once shared.</p>
        </div>
      </div>

      <div>
        <label htmlFor="headline" className={labelClass}>
          Headline <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="headline"
          name="headline"
          maxLength={140}
          defaultValue={defaults.headline}
          placeholder="Systematic NSE F&O trader · 3-year published record"
          className={inputClass}
        />
        <FieldError messages={errors?.headline} />
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={defaults.bio}
          placeholder="A short intro shown on your public research profile."
          className={inputClass}
        />
        <FieldError messages={errors?.bio} />
      </div>

      <TraderDetailFields details={defaults.details} />

      <div>
        <label htmlFor="strategy" className={labelClass}>
          Strategy notes <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="strategy"
          name="strategy"
          rows={2}
          maxLength={500}
          defaultValue={defaults.strategy}
          placeholder="Market structure, statistical arbitrage, factor research, or equity deep dives."
          className={inputClass}
        />
        <FieldError messages={errors?.strategy} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="instruments" className={labelClass}>
            Instruments <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="instruments"
            name="instruments"
            maxLength={200}
            defaultValue={defaults.instruments}
            placeholder="NIFTY, BANKNIFTY options, ES futures"
            className={inputClass}
          />
          <FieldError messages={errors?.instruments} />
        </div>
        <div>
          <label htmlFor="riskRules" className={labelClass}>
            Risk rules <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="riskRules"
            name="riskRules"
            rows={2}
            maxLength={500}
            defaultValue={defaults.riskRules}
            placeholder="Max 2 lots; daily stop at 1% of capital."
            className={inputClass}
          />
          <FieldError messages={errors?.riskRules} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving..." : "Save trader profile"}
        </button>
        {state?.saved && (
          <span className="text-sm text-zinc-100" role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
