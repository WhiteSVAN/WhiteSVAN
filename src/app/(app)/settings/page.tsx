import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { accountProofLevel } from "@/lib/proof";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";
import { PortalSettingsForm } from "./portal-settings-form";
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

export default async function SettingsPage() {
  const userId = await requireUserId();
  const profile = await prisma.traderProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      slug: true,
      isPublic: true,
      hideAmounts: true,
      hideBrokers: true,
      updateCadence: true,
      disclaimer: true,
      openToWork: true,
      headline: true,
      services: true,
      contactUrl: true,
    },
  });
  if (!profile) redirect("/onboarding");

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accountName: true,
      broker: true,
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
        transparencyScore: true,
        proofLevel: true,
        netPnl: true,
        changeSummary: true,
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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Research profile and privacy</h2>
        <p className="mt-1 text-sm text-slate-500">
          Control who can see your Quantidive profile and what it reveals.
        </p>
        <div className="mt-4">
          <PortalSettingsForm
            slug={profile.slug}
            isPublic={profile.isPublic}
            hideAmounts={profile.hideAmounts}
            hideBrokers={profile.hideBrokers}
            updateCadence={profile.updateCadence}
            disclaimer={profile.disclaimer ?? ""}
            openToWork={profile.openToWork}
            headline={profile.headline ?? ""}
            services={profile.services ?? ""}
            contactUrl={profile.contactUrl ?? ""}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Proof and evidence</h2>
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="font-medium text-slate-800">
            Proof Level {proofLevel}: {PROOF_LEVELS[proofLevel].label}
          </span>
          <p className="mt-0.5 text-slate-500">{PROOF_LEVELS[proofLevel].blurb}</p>
          <p className="mt-1 text-xs text-slate-400">
            Add a broker statement for Level 3, or a tax return / official tax record for Level 4.
          </p>
        </div>

        <div className="mt-5">
          <EvidenceUploader
            accounts={accounts.map((a) => ({ id: a.id, accountName: a.accountName }))}
          />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">Evidence locker</h3>
          {evidence.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No files uploaded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-800">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <a
                      href={`/api/evidence/${e.id}`}
                      target="_blank"
                      className="font-medium text-blue-700 hover:text-blue-800"
                    >
                      {e.label || e.originalName}
                    </a>
                    <p className="text-xs text-slate-400">
                      {KIND_LABEL[e.kind]} / {Math.max(1, Math.round(e.size / 1024))} KB
                      {e.account && ` / ${e.account.accountName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.kind === EvidenceKind.TAX_RETURN ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Verification only
                      </span>
                    ) : (
                      <form action={toggleEvidencePublic}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            e.isPublic
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {e.isPublic ? "Public" : "Private"}
                        </button>
                      </form>
                    )}
                    <form action={deleteEvidence}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="text-xs text-red-600 hover:text-red-700">
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

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Publishing history</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your source-history audit trail and the immutable versions visible on your research profile.
        </p>
        <div className="mt-4">
          <UpdateHistory
            uploads={uploads.map((u) => ({ ...u, netPnl: Number(u.netPnl) }))}
            versions={versions.map((v) => ({ ...v, netPnl: Number(v.netPnl) }))}
            followers={followers}
            queuedCount={queuedCount}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Trading accounts and data</h2>
        <p className="mt-1 text-sm text-slate-500">
          Loaded the wrong source history? Clear an account&apos;s trades, delete an account entirely,
          or reset everything. These actions can&apos;t be undone.
        </p>
        <div className="mt-4">
          <AccountData
            accounts={accounts.map((a) => ({
              id: a.id,
              accountName: a.accountName,
              broker: a.broker,
              tradeCount: a._count.trades,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
