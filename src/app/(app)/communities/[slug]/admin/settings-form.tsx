"use client";

import { useActionState } from "react";
import { FormError, inputClass, labelClass } from "@/components/form";
import { COMMUNITY_LIMITS } from "@/lib/communities";
import { updateCommunitySettings } from "./actions";

export function CommunitySettingsForm({
  communityId,
  description,
  rules,
  visibility,
  requireApproval,
}: {
  communityId: string;
  description: string;
  rules: string;
  visibility: "PUBLIC" | "PRIVATE";
  requireApproval: boolean;
}) {
  const [state, action, pending] = useActionState(updateCommunitySettings, undefined);
  // After a failed save, keep the submitted edits instead of the last saved values.
  const v = state?.values ?? { description, rules, visibility, requireApproval };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="communityId" value={communityId} />
      <div>
        <label htmlFor="settings-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="settings-description"
          name="description"
          rows={3}
          maxLength={COMMUNITY_LIMITS.description}
          defaultValue={v.description}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="settings-rules" className={labelClass}>
          Rules
        </label>
        <textarea
          id="settings-rules"
          name="rules"
          rows={5}
          maxLength={COMMUNITY_LIMITS.rules}
          defaultValue={v.rules}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="settings-visibility" className={labelClass}>
          Visibility
        </label>
        <select id="settings-visibility" name="visibility" defaultValue={v.visibility} className={inputClass}>
          <option value="PUBLIC">Public — listed; any signed-in user can read</option>
          <option value="PRIVATE">Private — unlisted; members only</option>
        </select>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="requireApproval" defaultChecked={v.requireApproval} className="mt-1" />
        <span>
          <span className="text-sm text-zinc-200">Require approval to join</span>
          <span className="block text-xs text-zinc-500">Invite links always skip approval.</span>
        </span>
      </label>
      <FormError message={state?.error} />
      {state?.ok && (
        <p className="text-sm text-[#dff5c4]" role="status">
          Settings saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
