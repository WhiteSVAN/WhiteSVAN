"use client";

import { useActionState, useState } from "react";
import { EVALUATION_PLANS, formatInr, planLimits } from "@/lib/prop-firm";
import { MAX_TRADEBOOK_BYTES } from "@/lib/track-record";
import { startTracking, syncTradebook, type TrackFormState } from "./actions";

const field = "mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--card-deep)] px-3.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none";
const label = "block text-xs font-medium text-[var(--muted)]";
const button = "inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-60";

function Message({ state }: { state: TrackFormState }) {
  return state?.message ? <p role="alert" className="text-sm text-[var(--danger)]">{state.message}</p> : null;
}

/** Choose the account size and the first day to count (also used to start over). */
export function StartTrackingForm({ today, submitLabel }: { today: string; submitLabel: string }) {
  const [state, submit, pending] = useActionState(startTracking, undefined);
  return (
    <form action={submit} className="space-y-4">
      <label className={label} htmlFor="track-plan">Account size
        <select id="track-plan" name="plan" defaultValue={EVALUATION_PLANS[0].id} className={field}>
          {EVALUATION_PLANS.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.label} · profit target {formatInr(planLimits(plan).profitTarget)}</option>
          ))}
        </select>
      </label>
      <label className={label} htmlFor="track-start">First day to count
        <input id="track-start" name="start" type="date" defaultValue={today} max={today} required className={field} />
      </label>
      <Message state={state} />
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

/** Upload a Zerodha Console tradebook CSV. */
export function SyncTradebookForm() {
  const [state, submit, pending] = useActionState(syncTradebook, undefined);
  const [tooLarge, setTooLarge] = useState(false);
  return (
    <form action={submit} className="space-y-4">
      <label className={label} htmlFor="track-tradebook">Tradebook CSV
        <input
          id="track-tradebook"
          name="tradebook"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(event) => setTooLarge((event.target.files?.[0]?.size ?? 0) > MAX_TRADEBOOK_BYTES)}
          className={`${field} py-3`}
        />
      </label>
      {tooLarge && <p role="alert" className="text-sm text-[var(--danger)]">That file is too large. Export a shorter date range.</p>}
      <Message state={state} />
      <button type="submit" disabled={pending || tooLarge} className={button}>{pending ? "Syncing…" : "Sync trades"}</button>
    </form>
  );
}
