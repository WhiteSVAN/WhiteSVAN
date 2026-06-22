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
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
  });

  // Archive grouped by month, newest first (insertion order preserves the desc sort).
  const byMonth = new Map<string, typeof reports>();
  for (const r of reports) {
    const group = byMonth.get(r.period);
    if (group) group.push(r);
    else byMonth.set(r.period, [r]);
  }

  const STATUS_BADGE: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700",
    APPROVED: "bg-amber-50 text-amber-700",
    DRAFT: "bg-slate-100 text-slate-500",
  };
  const STATUS_LABEL: Record<string, string> = {
    PUBLISHED: "Published",
    APPROVED: "Approved",
    DRAFT: "Draft",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Research briefs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a monthly research brief from verified metrics, edit it, then publish it to your profile.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-800">Generate a brief</h2>
        <p className="mt-1 text-sm text-slate-500">
          truSVAN computes the numbers; AI only drafts the research-facing narrative.
        </p>
        <div className="mt-4">
          {accountOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Connect trading history first, then generate a monthly research brief.
            </p>
          ) : (
            <GenerateReportForm accounts={accountOptions} />
          )}
        </div>
      </div>

      <div>
        <h2 className="text-base font-medium text-slate-800">Brief archive</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No reports yet.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {[...byMonth.entries()].map(([period, group]) => (
              <div key={period}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {periodLabel(period)}
                </h3>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-800 bg-slate-900/70">
                  {group.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/reports/${r.id}`}
                        className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-800/70"
                      >
                        <span className="text-slate-800">{r.account.accountName}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? STATUS_BADGE.DRAFT}`}
                        >
                          {STATUS_LABEL[r.status] ?? "Draft"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
