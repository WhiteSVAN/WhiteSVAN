/**
 * Structured trader-identity inputs, shared by onboarding and settings.
 * Server-safe (no hooks), uncontrolled inputs posting option keys.
 */
import { inputClass, labelClass } from "@/components/form";
import {
  CAPITAL_BANDS,
  MARKETS,
  REGIONS,
  REGISTRATION_TYPES,
  STRATEGY_TAGS,
  type Option,
} from "@/lib/profile-options";
import type { TraderDetails } from "@/lib/profile-details";

export function ChipGroup({
  name,
  legend,
  options,
  selected,
}: {
  name: string;
  legend: string;
  options: Option[];
  selected: readonly string[];
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.key}
            className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 transition has-[:checked]:border-[#baf277] has-[:checked]:text-[#dff5c4]"
          >
            <input type="checkbox" name={name} value={o.key} defaultChecked={selected.includes(o.key)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField({
  name,
  label,
  options,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  options: Option[];
  value: string | null;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TraderDetailFields({ details }: { details?: Partial<TraderDetails> }) {
  const d = details ?? {};
  return (
    <div className="space-y-5">
      <ChipGroup name="markets" legend="Markets traded" options={MARKETS} selected={d.markets ?? []} />
      <ChipGroup name="strategyTags" legend="Strategy style" options={STRATEGY_TAGS} selected={d.strategyTags ?? []} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="region" label="Region" options={REGIONS} value={d.region ?? null} placeholder="Not set" />
        <SelectField name="capitalBand" label="Capital band" options={CAPITAL_BANDS} value={d.capitalBand ?? null} placeholder="Not disclosed" />
        <div>
          <label htmlFor="experienceYears" className={labelClass}>
            Years trading
          </label>
          <input
            id="experienceYears"
            name="experienceYears"
            type="number"
            min={0}
            max={60}
            defaultValue={d.experienceYears ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="credentials" className={labelClass}>
          Credentials <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="credentials"
          name="credentials"
          maxLength={200}
          defaultValue={d.credentials ?? ""}
          className={inputClass}
          placeholder="CFA Charterholder, NISM Series XV, FRM"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="registrationType"
          label="Regulatory registration"
          options={REGISTRATION_TYPES}
          value={d.registrationType ?? null}
          placeholder="Prefer not to say"
        />
        <div>
          <label htmlFor="registrationNumber" className={labelClass}>
            Registration no.
          </label>
          <input
            id="registrationNumber"
            name="registrationNumber"
            maxLength={40}
            defaultValue={d.registrationNumber ?? ""}
            className={inputClass}
            placeholder="e.g. INH000012345"
          />
        </div>
      </div>
      <p className="text-xs leading-5 text-zinc-500">
        Credentials and registration are shown as <b className="font-medium text-zinc-400">self-declared</b>.
        TrustSVAN does not check them against regulator databases yet.
      </p>
    </div>
  );
}
