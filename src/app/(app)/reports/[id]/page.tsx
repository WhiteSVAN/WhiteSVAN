import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrader } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { aiReportSchema } from "@/lib/ai/schema";
import { ReportEditor } from "./report-editor";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await requireTrader();
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, userId },
    select: {
      id: true,
      period: true,
      status: true,
      aiReport: true,
      account: { select: { accountName: true } },
    },
  });
  if (!report) notFound();

  const parsed = aiReportSchema.safeParse(report.aiReport);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/reports" className="text-sm text-zinc-200 hover:text-zinc-100">
          Back to briefs
        </Link>
        <p className="mt-4 rounded-lg bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
          This brief&apos;s content could not be read. Try regenerating it.
        </p>
      </div>
    );
  }

  return (
    <ReportEditor
      id={report.id}
      period={report.period}
      status={report.status}
      accountName={report.account.accountName}
      report={parsed.data}
    />
  );
}
