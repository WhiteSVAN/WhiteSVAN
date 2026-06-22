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
        <p className="text-sm font-medium text-blue-700">Broker connection</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Connect source-backed trading history
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Quantidive verification is built for read-only broker and prop-firm sources. The platform
          turns broker-reported transactions into performance, proof, freshness, and risk metrics
          without exposing account numbers or allowing trade execution.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Read-only access", "Quantidive should never trade, move funds, or change broker accounts."],
          ["Broker-reported record", "Metrics come from source history rather than editable screenshots."],
          ["Private by default", "Account size, account numbers, and raw evidence stay controlled by the trader."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
          </div>
        ))}
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
