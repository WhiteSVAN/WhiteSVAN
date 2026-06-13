import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/format";
import { GenerateReportForm } from "./generate-form";

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default async function ReportsPage() {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: user.id },
    select: { id: true, accountName: true },
    orderBy: { createdAt: "asc" },
  });
  const dpRows = await prisma.dailyPnl.findMany({
    where: { account: { userId: user.id } },
    select: { accountId: true, tradeDate: true },
  });
  const periodsByAccount = new Map<string, Set<string>>();
  for (const r of dpRows) {
    const month = toISODate(r.tradeDate).slice(0, 7);
    let set = periodsByAccount.get(r.accountId);
    if (!set) {
      set = new Set();
      periodsByAccount.set(r.accountId, set);
    }
    set.add(month);
  }
  const accountOptions = accounts.map((a) => ({
    id: a.id,
    accountName: a.accountName,
    periods: [...(periodsByAccount.get(a.id) ?? [])].sort().reverse(),
  }));

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      period: true,
      status: true,
      createdAt: true,
      account: { select: { accountName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate an AI monthly report from your verified metrics, edit it, then publish.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Generate a report</h2>
        <p className="mt-1 text-sm text-slate-500">
          TrustSVAN computes the numbers; the AI only writes the narrative.
        </p>
        <div className="mt-4">
          {accountOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Import trades first — then you can generate a monthly report.
            </p>
          ) : (
            <GenerateReportForm accounts={accountOptions} />
          )}
        </div>
      </div>

      <div>
        <h2 className="text-base font-medium text-slate-800">Your reports</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No reports yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="text-slate-800">
                    {r.account.accountName} · {periodLabel(r.period)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      r.status === "PUBLISHED"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {r.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
