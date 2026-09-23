"use client";

import { useActionState } from "react";
import { saveAvailability } from "./actions";
import { btnPrimary, FormError, inputClass, labelClass } from "@/components/form";

/** Whether clients may request a conversation, plus services + contact link. */
export function AvailabilityForm({
  acceptInquiries,
  services,
  contactUrl,
}: {
  acceptInquiries: boolean;
  services: string;
  contactUrl: string;
}) {
  const [state, action, pending] = useActionState(saveAvailability, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />

      <label className="flex items-start gap-3">
        <input type="checkbox" name="acceptInquiries" defaultChecked={acceptInquiries} className="mt-1" />
        <span>
          <span className="text-sm font-medium text-zinc-700">
            Accept conversation requests from clients
          </span>
          <span className="block text-xs text-zinc-500">
            Signed-in clients can send you a short request from your public profile. You choose to
            accept, decline, or ignore; messaging opens only after you accept. A request is a
            conversation, never a mandate or allocation.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="services" className={labelClass}>
          What you offer <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="services"
          name="services"
          rows={2}
          maxLength={600}
          defaultValue={services}
          placeholder="Research collaboration, strategy consulting, prop-firm roles…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="contactUrl" className={labelClass}>
          Contact link <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="contactUrl"
          name="contactUrl"
          type="text"
          maxLength={300}
          defaultValue={contactUrl}
          placeholder="you@email.com, cal.com/you, or https://…"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-zinc-500">
          An email or link you control. We never expose your sign-in email.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving..." : "Save availability"}
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
