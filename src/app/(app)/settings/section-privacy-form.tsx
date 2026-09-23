"use client";

import { useActionState } from "react";
import { saveSectionPrivacy } from "./actions";
import { btnPrimary, FormError } from "@/components/form";
import { PROFILE_SECTIONS } from "@/lib/profile-options";

/** Hide individual public-profile sections without deleting anything. */
export function SectionPrivacyForm({ hidden }: { hidden: string[] }) {
  const [state, action, pending] = useActionState(saveSectionPrivacy, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <fieldset>
        <legend className="text-sm text-zinc-500">
          Checked sections are hidden from your public profile. Your data is kept and still used for
          your private dashboard.
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROFILE_SECTIONS.map((s) => (
            <label
              key={s.key}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300 has-[:checked]:border-[#57733a]"
            >
              <input type="checkbox" name="hiddenSections" value={s.key} defaultChecked={hidden.includes(s.key)} />
              <span>
                Hide <span className="text-zinc-100">{s.label.toLowerCase()}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving..." : "Save section privacy"}
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
