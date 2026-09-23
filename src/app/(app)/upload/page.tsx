import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { CreateAccountForm } from "./create-account-form";
import { UploadFlow } from "./upload-flow";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const { account: selectedAccountId } = await searchParams;

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: user.id },
    select: { id: true, accountName: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="terminal-label">Data import / private by default</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-zinc-900">
          Import broker history
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Upload an export from your broker or prop firm. TrustSVAN calculates performance and risk
          from the imported rows, records the file fingerprint and coverage period, and never gains
          permission to trade or move funds.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["1 / Choose account", "Select the account this file belongs to."],
          ["2 / Review file", "Check the detected format, columns, dates, and skipped rows."],
          ["3 / Import", "Add the parsed rows to your private performance record."],
        ].map(([title, body]) => (
          <div key={title} className="terminal-card p-4">
            <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-xs leading-5 text-zinc-400">
        An uploaded export is not the same as a direct broker connection or independent review.
        Public profiles identify the source as trader-uploaded and show the dates it covers.
      </div>

      <div>
        {accounts.length === 0 ? (
          <CreateAccountForm />
        ) : (
          <UploadFlow accounts={accounts} selectedAccountId={selectedAccountId} />
        )}
      </div>
    </div>
  );
}
