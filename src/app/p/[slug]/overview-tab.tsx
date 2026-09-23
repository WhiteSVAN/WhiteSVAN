import { prisma } from "@/lib/db";
import { redactText } from "@/lib/redaction";
import { cadenceLabel, describeFreshness, toCadence } from "@/lib/freshness";
import { toRecordContext } from "@/lib/record-context";
import { formatDay, profileHref, safeExternalHref } from "@/lib/profile-page";
import { CredentialsBlock } from "@/components/portal/credentials-block";
import { HiddenSection } from "@/components/portal/hidden-section";
import { ProfileTrust } from "@/components/portal/profile-trust";
import { RecordSummary } from "@/components/portal/record-summary";
import { getLatestImport, getPrivateTerms, type VersionSummaryRow, type ViewableProfile } from "./data";

function AboutBlock({ label, text }: { label: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <div className="min-w-0">
      <h3 className="terminal-label">{label}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-zinc-300">{text.trim()}</p>
    </div>
  );
}

/** Overview: who the trader is, what they declare, and a factual summary of the record. */
export async function OverviewTab({ view, latest }: { view: ViewableProfile; latest: VersionSummaryRow | null }) {
  const { profile, hidden, isOwner } = view;
  const performanceHidden = hidden.has("performance");

  const [lastImport, riskEvents, terms] = await Promise.all([
    getLatestImport(profile.userId),
    latest && !performanceHidden
      ? prisma.riskEvent.findMany({
          where: { profileId: profile.id, versionId: latest.id, isClientVisible: true },
          select: { id: true, type: true, severity: true, title: true, description: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    profile.hideBrokers ? getPrivateTerms(profile.userId) : Promise.resolve([] as string[]),
  ]);

  // Risk events and change summaries are generated text that can carry dollar
  // figures or account labels — apply the profile's display privacy to them.
  const redact = (text: string) => redactText(text, { hideAmounts: profile.hideAmounts, terms });
  const record = latest ? toRecordContext(latest) : null;
  const cadence = toCadence(profile.updateCadence);
  const fresh = describeFreshness(cadence, latest?.periodEnd ?? null);
  const contactHref = safeExternalHref(profile.contactUrl);
  const hasAbout = [profile.bio, profile.strategy, profile.instruments, profile.riskRules].some((t) => t?.trim());

  return (
    <div className="space-y-6">
      <section className="terminal-card p-5" aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-base font-medium text-white">
          About
        </h2>
        {hasAbout ? (
          <div className="mt-4 space-y-4">
            <AboutBlock label="Bio" text={profile.bio} />
            <AboutBlock label="Strategy notes" text={profile.strategy} />
            <AboutBlock label="Instruments" text={profile.instruments} />
            <AboutBlock label="Risk rules" text={profile.riskRules} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">The trader hasn&apos;t added a description yet.</p>
        )}
      </section>

      {(profile.openToWork || contactHref) && (
        <section className="terminal-card p-5 print:hidden" aria-labelledby="work-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="work-heading" className="text-base font-medium text-white">
                Work with {profile.displayName}
              </h2>
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-400">
                {profile.services?.trim() ||
                  "Open to research collaboration and professional conversations. Not an offer of advice or managed money."}
              </p>
            </div>
            {contactHref && (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="shrink-0 rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-300"
              >
                Contact link
              </a>
            )}
          </div>
        </section>
      )}

      {hidden.has("credentials") ? (
        <HiddenSection title="Credentials & registration" isOwner={isOwner} />
      ) : (
        <CredentialsBlock
          credentials={profile.credentials}
          experienceYears={profile.experienceYears}
          registrationType={profile.registrationType}
          registrationNumber={profile.registrationNumber}
        />
      )}

      <RecordSummary
        record={record}
        lastImport={lastImport}
        freshness={{ label: fresh.label, blurb: fresh.blurb, tone: fresh.tone }}
        cadence={cadenceLabel(cadence)}
        proofHref={profileHref(profile.slug, "proof")}
      />

      {performanceHidden ? (
        latest && <HiddenSection title="Changes & risk events" isOwner={isOwner} />
      ) : (
        <ProfileTrust
          showStatus={false}
          freshness={{ label: fresh.label, blurb: fresh.blurb, tone: fresh.tone }}
          lastUpdatedLabel={latest ? formatDay(latest.publishedAt) : null}
          cadenceLabel={cadenceLabel(cadence)}
          changeSummary={latest?.changeSummary ? redact(latest.changeSummary) : null}
          riskEvents={riskEvents.map((e) => ({ ...e, title: redact(e.title), description: redact(e.description) }))}
          proofLevel={null}
        />
      )}
    </div>
  );
}
