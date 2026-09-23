"use client";

import { useActionState } from "react";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";
import { COMMUNITY_GUARDRAIL, COMMUNITY_LIMITS } from "@/lib/communities";
import { createCommunity } from "./actions";

export function CreateCommunityForm() {
  const [state, action, pending] = useActionState(createCommunity, undefined);
  const v = state?.values ?? {};
  const err = (key: string) => (state?.fieldErrors?.[key] ? [state.fieldErrors[key]] : undefined);

  return (
    <form action={action} className="space-y-4">
      <p className="rounded-md border border-[#3c4a36] bg-[#141c16] px-3 py-2 text-xs leading-5 text-[#c5d9ad]">
        {COMMUNITY_GUARDRAIL}
      </p>

      <div>
        <label htmlFor="community-name" className={labelClass}>
          Name
        </label>
        <input
          id="community-name"
          name="name"
          required
          minLength={COMMUNITY_LIMITS.nameMin}
          maxLength={COMMUNITY_LIMITS.nameMax}
          defaultValue={v.name}
          className={inputClass}
          placeholder="e.g. Index options post-mortems"
        />
        <FieldError messages={err("name")} />
      </div>

      <div>
        <label htmlFor="community-slug" className={labelClass}>
          Link <span className="normal-case tracking-normal text-zinc-500">(optional — made from the name)</span>
        </label>
        <div className="mt-2 flex min-w-0 items-center gap-1 text-sm text-zinc-500">
          <span className="shrink-0 font-mono text-xs">/communities/</span>
          <input
            id="community-slug"
            name="slug"
            maxLength={COMMUNITY_LIMITS.slugMax}
            defaultValue={v.slug}
            className={`${inputClass} !mt-0 min-w-0`}
            placeholder="index-options"
            autoCapitalize="none"
          />
        </div>
        <FieldError messages={err("slug")} />
      </div>

      <div>
        <label htmlFor="community-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="community-description"
          name="description"
          rows={3}
          maxLength={COMMUNITY_LIMITS.description}
          defaultValue={v.description}
          className={inputClass}
          placeholder="What the room studies and who it's for."
        />
        <FieldError messages={err("description")} />
      </div>

      <div>
        <label htmlFor="community-rules" className={labelClass}>
          Rules
        </label>
        <textarea
          id="community-rules"
          name="rules"
          rows={4}
          maxLength={COMMUNITY_LIMITS.rules}
          defaultValue={v.rules}
          className={inputClass}
          placeholder={"1. Show your method and data.\n2. Post-mortems over predictions.\n3. No calls to action."}
        />
        <FieldError messages={err("rules")} />
      </div>

      <fieldset>
        <legend className={labelClass}>Visibility</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-3 has-[:checked]:border-[#baf277]">
            <input type="radio" name="visibility" value="PUBLIC" defaultChecked={(v.visibility ?? "PUBLIC") === "PUBLIC"} className="mt-1" />
            <span>
              <span className="block text-sm text-zinc-200">Public</span>
              <span className="block text-xs text-zinc-500">Listed in Discover; any signed-in user can read.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-3 has-[:checked]:border-[#baf277]">
            <input type="radio" name="visibility" value="PRIVATE" defaultChecked={v.visibility === "PRIVATE"} className="mt-1" />
            <span>
              <span className="block text-sm text-zinc-200">Private</span>
              <span className="block text-xs text-zinc-500">Unlisted; members join by invite or approval.</span>
            </span>
          </label>
        </div>
        <FieldError messages={err("visibility")} />
      </fieldset>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="requireApproval"
          defaultChecked={state?.values ? v.requireApproval === "on" : true}
          className="mt-1"
        />
        <span>
          <span className="text-sm text-zinc-200">Require approval to join</span>
          <span className="block text-xs text-zinc-500">
            Join requests wait for an owner or admin. Invite links always skip approval.
          </span>
        </span>
      </label>

      <FormError message={state?.error} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Creating…" : "Create community"}
      </button>
    </form>
  );
}
