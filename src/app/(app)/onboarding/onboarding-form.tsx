"use client";

import { useActionState, useState } from "react";
import { createProfile } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

/** Mirror of the server `slugSchema` rules for live suggestions. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(createProfile, undefined);
  const [displayName, setDisplayName] = useState(defaultName);
  const [slug, setSlug] = useState(() => slugify(defaultName));
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.message} />

      <div>
        <label htmlFor="displayName" className={labelClass}>
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          required
          className={inputClass}
          placeholder="Aditya Nalluri"
        />
        <FieldError messages={state?.errors?.displayName} />
      </div>

      <div>
        <label htmlFor="slug" className={labelClass}>
          Public handle
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
          <span className="pl-3 text-sm text-slate-400">/p/</span>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            required
            className="block w-full rounded-r-lg border-0 bg-transparent px-1 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            placeholder="your-handle"
          />
        </div>
        <FieldError messages={state?.errors?.slug} />
      </div>

      <div>
        <label htmlFor="strategy" className={labelClass}>
          Strategy <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="strategy"
          name="strategy"
          rows={2}
          className={inputClass}
          placeholder="Intraday futures momentum; risk-defined."
        />
        <FieldError messages={state?.errors?.strategy} />
      </div>

      <div>
        <label htmlFor="instruments" className={labelClass}>
          Instruments <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="instruments"
          name="instruments"
          className={inputClass}
          placeholder="ES, NQ, options"
        />
        <FieldError messages={state?.errors?.instruments} />
      </div>

      <div>
        <label htmlFor="riskRules" className={labelClass}>
          Risk rules <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="riskRules"
          name="riskRules"
          rows={2}
          className={inputClass}
          placeholder="Max 2 contracts; daily stop at -$1,000."
        />
        <FieldError messages={state?.errors?.riskRules} />
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          className={inputClass}
          placeholder="A short intro shown on your public portal."
        />
        <FieldError messages={state?.errors?.bio} />
      </div>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Continue to dashboard"}
      </button>
    </form>
  );
}
