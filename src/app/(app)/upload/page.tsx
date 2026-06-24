import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { BrokerConnect } from "./broker-connect";
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
        <p className="text-sm font-medium text-zinc-200">Broker connection</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Connect source-backed trading history
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          TrustSVAN verification is built for read-only broker and prop-firm sources. The platform
          turns broker-reported transactions into performance, proof, freshness, and risk metrics
          without exposing account numbers or allowing trade execution.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Read-only access", "TrustSVAN should never trade, move funds, or change broker accounts."],
          ["Broker-reported record", "Metrics come from source history rather than editable screenshots."],
          ["Private by default", "Account size, account numbers, and raw evidence stay controlled by the trader."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{body}</p>
          </div>
        ))}
      </div>

      {/* Direct read-only connection — the product direction. */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-900">Direct read-only connection</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
          Connect your broker read-only — no login shared, no trade execution, revocable anytime.
          Pick your broker to see how linking works. Connectors are rolling out; until then, load
          broker-reported history below.
        </p>
        <div className="mt-4">
          <BrokerConnect />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        Or load broker-reported history
        <span className="h-px flex-1 bg-zinc-200" />
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
