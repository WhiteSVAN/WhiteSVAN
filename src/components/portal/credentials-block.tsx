import { BadgeInfo } from "lucide-react";
import { optionLabel } from "@/lib/profile-options";
import { yearsTradingLabel } from "@/lib/profile-page";

/**
 * Credentials, experience and regulatory registration exactly as the trader
 * typed them. Always labelled self-declared: TrustSVAN does not check these
 * against regulator records.
 */
export function CredentialsBlock({
  credentials,
  experienceYears,
  registrationType,
  registrationNumber,
}: {
  credentials: string | null;
  experienceYears: number | null;
  registrationType: string | null;
  registrationNumber: string | null;
}) {
  const registration = optionLabel("registrationTypes", registrationType);
  const registered = registrationType != null && registrationType !== "none";
  const years = yearsTradingLabel(experienceYears);
  const empty = !credentials?.trim() && !registration && !years;

  return (
    <section className="terminal-card p-5" aria-labelledby="credentials-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="credentials-heading" className="text-base font-medium text-white">
          Credentials &amp; registration
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400">
          <BadgeInfo className="h-3.5 w-3.5" aria-hidden="true" />
          Self-declared — not checked against regulator records
        </span>
      </div>

      {empty ? (
        <p className="mt-3 text-sm text-zinc-400">No credentials or registration declared.</p>
      ) : (
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {years && (
            <div className="min-w-0">
              <dt className="terminal-label">Experience</dt>
              <dd className="mt-1 text-sm text-zinc-200">{years}</dd>
            </div>
          )}
          {registration && (
            <div className="min-w-0">
              <dt className="terminal-label">Registration</dt>
              <dd className="mt-1 break-words text-sm text-zinc-200">
                {registration}
                {registered && registrationNumber?.trim() && (
                  <span className="font-mono text-zinc-400"> · {registrationNumber.trim()}</span>
                )}
              </dd>
            </div>
          )}
          {credentials?.trim() && (
            <div className="min-w-0 sm:col-span-2">
              <dt className="terminal-label">Credentials</dt>
              <dd className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-zinc-300">
                {credentials.trim()}
              </dd>
            </div>
          )}
        </dl>
      )}

      {registered && (
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Registration does not imply any regulator has reviewed this record, and it does not guarantee
          performance. Check the registration directly with the regulator.
        </p>
      )}
    </section>
  );
}
