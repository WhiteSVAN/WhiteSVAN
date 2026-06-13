import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { aiReportSchema } from "@/lib/ai/schema";
import { ReportEditor } from "./report-editor";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
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
        <Link href="/reports" className="text-sm text-blue-700 hover:text-blue-800">
          ← Reports
        </Link>
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          This report&apos;s content could not be read. Try regenerating it.
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
