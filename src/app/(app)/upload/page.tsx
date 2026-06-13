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
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Import trades</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload a CSV from your broker or prop firm. Map the columns, preview the rows, then import.
      </p>
      <div className="mt-6">
        {accounts.length === 0 ? (
          <CreateAccountForm />
        ) : (
          <UploadFlow accounts={accounts} selectedAccountId={selectedAccountId} />
        )}
      </div>
    </div>
  );
}
