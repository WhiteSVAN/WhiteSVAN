"use client";

import { useActionState } from "react";
import { createClientProfile } from "../actions";
import { btnPrimary, FormError, inputClass, labelClass } from "@/components/form";
import { ChipGroup, SelectField } from "@/components/profile/detail-fields";
import { CLIENT_TYPES, MARKETS, REGIONS, STRATEGY_TAGS } from "@/lib/profile-options";

export interface ClientDefaults {
  organization: string | null;
  clientType: string | null;
  markets: string[];
  regions: string[];
  strategyTags: string[];
  note: string | null;
}

export function ClientOnboardingForm({ defaults, next }: { defaults?: ClientDefaults; next?: "settings" }) {
  const [state, action, pending] = useActionState(createClientProfile, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.message} />
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="clientType" label="You are" options={CLIENT_TYPES} value={defaults?.clientType ?? null} placeholder="Choose one" />
        <div>
          <label htmlFor="organization" className={labelClass}>
            Organization <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
          </label>
          <input id="organization" name="organization" maxLength={120} defaultValue={defaults?.organization ?? ""} className={inputClass} />
        </div>
      </div>
      <ChipGroup name="markets" legend="Markets of interest" options={MARKETS} selected={defaults?.markets ?? []} />
      <ChipGroup name="regions" legend="Regions" options={REGIONS} selected={defaults?.regions ?? []} />
      <ChipGroup name="strategyTags" legend="Strategy styles" options={STRATEGY_TAGS} selected={defaults?.strategyTags ?? []} />
      <div>
        <label htmlFor="note" className={labelClass}>
          Anything else <span className="normal-case tracking-normal text-zinc-500">(private)</span>
        </label>
        <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={defaults?.note ?? ""} className={inputClass} placeholder="e.g. Looking for NSE F&O traders with 2+ years of records." />
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving..." : next ? "Save preferences" : "Continue to discovery"}
      </button>
    </form>
  );
}
