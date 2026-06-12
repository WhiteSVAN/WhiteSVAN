import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

const METRIC_CARDS = ["Net P&L", "Win rate", "Max drawdown", "Profit factor"];

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user.profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Public portal: <span className="font-mono text-slate-700">/p/{user.profile.slug}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRIC_CARDS.map((label) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-base font-medium text-slate-800">No trading data yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          CSV upload and the metrics dashboard arrive in the next milestone. Once you import a
          broker or prop-firm export, your equity curve and risk analytics appear here.
        </p>
      </div>
    </div>
  );
}
