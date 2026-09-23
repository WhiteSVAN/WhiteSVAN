import type { Metadata } from "next";
import { format } from "date-fns";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { accountProofLevel } from "@/lib/proof";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";
import { PortalSettingsForm } from "./portal-settings-form";
import { TraderProfileForm } from "./trader-profile-form";
import { AvailabilityForm } from "./availability-form";
import { SectionPrivacyForm } from "./section-privacy-form";
import { AccountBasicsForm } from "./account-basics-form";
import { ClientSettings } from "./client-settings";
import { EvidenceUploader } from "./evidence-uploader";
import { AccountData } from "./account-data";
import { UpdateHistory } from "./update-history";
import { toggleEvidencePublic, deleteEvidence } from "./actions";
import { EvidenceKind } from "@/generated/prisma/enums";

const KIND_LABEL: Record<string, string> = {
  STATEMENT: "Statement",
  TAX_RETURN: "Tax return",
  PAYOUT: "Payout",
  EXPORT: "Export",
  OTHER: "Other",
};

export const metadata: Metadata = { title: "Settings · TrustSVAN" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireOnboardedUser();
  const saved = (await searchParams).saved === "1";
  if (user.role === "CLIENT") return <ClientSettings userId={user.id} saved={saved} />;

  const userId = user.id;
  const [profile, account] = await Promise.all([
    prisma.traderProfile.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true,
        slug: true,
        displayName: true,
        headline: true,
        bio: true,
        strategy: true,
        instruments: true,
        riskRules: true,
        experienceYears: true,
        markets: true,
        strategyTags: true,
        region: true,
        capitalBand: true,
        credentials: true,
        registrationType: true,
        registrationNumber: true,
        isPublic: true,
        hideAmounts: true,
        hideBrokers: true,
        updateCadence: true,
        disclaimer: true,
        acceptInquiries: true,
        services: true,
        contactUrl: true,
        hiddenSections: true,
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
  ]);

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accountName: true,
      broker: true,
      currency: true,
      _count: { select: { trades: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let proofLevel: ProofLevel = 1;
  const primary = accounts[0];
  if (primary) {
    const hasData = (await prisma.dailyPnl.count({ where: { accountId: primary.id } })) > 0;
    proofLevel = await accountProofLevel(primary.id, hasData);
  }

  const evidence = await prisma.evidence.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      label: true,
      originalName: true,
      size: true,
      isPublic: true,
      account: { select: { accountName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // MVP2 audit trail: imports, published versions, followers, queued notifications.
  const accountIds = accounts.map((a) => a.id);
  const [uploads, versions, followers, queuedCount] = await Promise.all([
    prisma.importBatch.findMany({
      where: { accountId: { in: accountIds } },
      select: {
        id: true,
        source: true,
        broker: true,
        originalFilename: true,
        fileHash: true,
        rowCount: true,
        periodStart: true,
        periodEnd: true,
        netPnl: true,
        createdAt: true,
        account: { select: { currency: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.profileVersion.findMany({
      where: { profileId: profile.id },
      select: {
        versionNumber: true,
        periodStart: true,
        periodEnd: true,
        proofLevel: true,
        netPnl: true,
        changeSummary: true,
        sourceBatch: { select: { account: { select: { currency: true } } } },
        publishedAt: true,
      },
      orderBy: { versionNumber: "desc" },
      take: 25,
    }),
    prisma.profileFollower.findMany({
      where: { profileId: profile.id },
      select: { email: true, status: true, frequency: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notificationEvent.count({ where: { profileId: profile.id, status: "QUEUED" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="terminal-label">Operator controls / private by default</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Settings</h1>
        <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {[
            ["#trader-profile", "Trader profile"],
            ["#availability", "Availability"],
            ["#privacy", "Privacy"],
            ["#sections", "Section privacy"],
            ["#evidence", "Evidence"],
            ["#history", "History"],
            ["#accounts", "Accounts"],
            ["#account", "Account"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="text-zinc-400 hover:text-[#baf277]">
              {label}
            </a>
          ))}
        </nav>
      </div>

      {saved && (
        <p className="rounded-lg border border-[#57733a] bg-[#1a2418] px-4 py-2 text-sm text-[#dff5c4]" role="status">
          Settings saved.
        </p>
      )}

      <section id="trader-profile" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Trader profile</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your public identity. Structured fields power the trader directory filters; credentials and
          registration are always labelled self-declared.
        </p>
        <div className="mt-4">
          <TraderProfileForm
            defaults={{
              slug: profile.slug,
              displayName: profile.displayName,
              headline: profile.headline ?? "",
              bio: profile.bio ?? "",
              strategy: profile.strategy ?? "",
              instruments: profile.instruments ?? "",
              riskRules: profile.riskRules ?? "",
              details: {
                experienceYears: profile.experienceYears,
                markets: profile.markets,
                strategyTags: profile.strategyTags,
                region: profile.region,
                capitalBand: profile.capitalBand,
                credentials: profile.credentials,
                registrationType: profile.registrationType,
                registrationNumber: profile.registrationNumber,
              },
            }}
          />
        </div>
      </section>

      <section id="availability" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Availability</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Let clients, firms, and collaborators know whether you&apos;re open to a conversation.
        </p>
        <div className="mt-4">
          <AvailabilityForm
            acceptInquiries={profile.acceptInquiries}
            services={profile.services ?? ""}
            contactUrl={profile.contactUrl ?? ""}
          />
        </div>
      </section>

      <section id="privacy" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Research profile and privacy</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Control who can see your TrustSVAN profile and what it reveals.
        </p>
        <div className="mt-4">
          <PortalSettingsForm
            slug={profile.slug}
            isPublic={profile.isPublic}
            hideAmounts={profile.hideAmounts}
            hideBrokers={profile.hideBrokers}
            updateCadence={profile.updateCadence}
            disclaimer={profile.disclaimer ?? ""}
          />
        </div>
      </section>

      <section id="sections" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Section privacy</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Hide parts of your public profile while keeping it public.
        </p>
        <div className="mt-4">
          <SectionPrivacyForm hidden={profile.hiddenSections} />
        </div>
      </section>

      <section id="evidence" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Record sources and evidence</h2>
        <div className="mt-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm">
          <span className="font-medium text-zinc-800">
            Current source: {PROOF_LEVELS[proofLevel].label}
          </span>
          <p className="mt-0.5 text-zinc-500">{PROOF_LEVELS[proofLevel].blurb}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Attach supporting files to document where the record came from. Files remain private
            unless you explicitly expose them, and an attachment is not an independent review.
          </p>
        </div>

        <div className="mt-5">
          <EvidenceUploader
            accounts={accounts.map((a) => ({ id: a.id, accountName: a.accountName }))}
          />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-700">Evidence locker</h3>
          {evidence.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No files uploaded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-800">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <a
                      href={`/api/evidence/${e.id}`}
                      target="_blank"
                      className="font-medium text-zinc-200 hover:text-zinc-100"
                    >
                      {e.label || e.originalName}
                    </a>
                    <p className="text-xs text-zinc-400">
                      {KIND_LABEL[e.kind]} / {Math.max(1, Math.round(e.size / 1024))} KB
                      {e.account && ` / ${e.account.accountName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.kind === EvidenceKind.TAX_RETURN ? (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                        Verification only
                      </span>
                    ) : (
                      <form action={toggleEvidencePublic}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            e.isPublic
                              ? "bg-zinc-900/70 text-zinc-100"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {e.isPublic ? "Listed on profile" : "Hidden"}
                        </button>
                      </form>
                    )}
                    <form action={deleteEvidence}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="history" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Publishing history</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your source-history audit trail and the immutable versions visible on your research profile.
        </p>
        <div className="mt-4">
          <UpdateHistory
            uploads={uploads.map(({ account: acct, ...u }) => ({
              ...u,
              netPnl: Number(u.netPnl),
              currency: acct.currency,
            }))}
            versions={versions.map(({ sourceBatch, ...v }) => ({
              ...v,
              netPnl: Number(v.netPnl),
              currency: sourceBatch?.account.currency ?? "USD",
            }))}
            followers={followers}
            queuedCount={queuedCount}
          />
        </div>
      </section>

      <section id="accounts" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Trading accounts and data</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Loaded the wrong source history? Clear an account&apos;s trades, delete an account entirely,
          or reset everything. These actions can&apos;t be undone.
        </p>
        <div className="mt-4">
          <AccountData
            accounts={accounts.map((a) => ({
              id: a.id,
              accountName: a.accountName,
              broker: a.broker,
              currency: a.currency,
              tradeCount: a._count.trades,
            }))}
          />
        </div>
      </section>

      <section id="account" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Account</h2>
        <div className="mt-4">
          <AccountBasicsForm
            name={account.name ?? ""}
            email={account.email}
            roleLabel="Trader"
            memberSince={format(account.createdAt, "MMM yyyy")}
          />
        </div>
      </section>
    </div>
  );
}
