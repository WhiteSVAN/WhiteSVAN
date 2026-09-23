import { prisma } from "@/lib/db";
import { aiReportSchema } from "@/lib/ai/schema";
import { ProfilePosts } from "@/components/posts/profile-posts";
import { ReportSections } from "@/components/report-sections";
import { HiddenSection } from "@/components/portal/hidden-section";
import { getPrivateTerms, type ViewableProfile } from "./data";

/** Posts: the trader's research posts plus their published written briefs. */
export async function PostsTab({ view }: { view: ViewableProfile }) {
  const { profile, hidden, isOwner, viewerId } = view;
  const briefsHidden = hidden.has("briefs");

  const [reportRows, terms] = await Promise.all([
    briefsHidden
      ? Promise.resolve([])
      : prisma.report.findMany({
          where: { userId: profile.userId, status: "PUBLISHED" },
          select: { id: true, period: true, aiReport: true },
          orderBy: { period: "desc" },
        }),
    profile.hideBrokers && !briefsHidden ? getPrivateTerms(profile.userId) : Promise.resolve([] as string[]),
  ]);
  const reports = reportRows.flatMap((r) => {
    const parsed = aiReportSchema.safeParse(r.aiReport);
    return parsed.success ? [{ id: r.id, period: r.period, report: parsed.data }] : [];
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="text-lg font-medium text-white">
          Posts
        </h2>
        {hidden.has("posts") ? (
          <HiddenSection title="Posts" isOwner={isOwner} />
        ) : (
          <ProfilePosts authorUserId={profile.userId} viewerId={viewerId} />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="briefs-heading">
        <h2 id="briefs-heading" className="text-lg font-medium text-white">
          Written briefs
        </h2>
        {briefsHidden ? (
          <HiddenSection title="Written briefs" isOwner={isOwner} />
        ) : reports.length === 0 ? (
          <p className="text-sm text-zinc-400">No written briefs published yet.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <ReportSections
                key={r.id}
                period={r.period}
                report={r.report}
                hideAmounts={profile.hideAmounts}
                redactTerms={terms}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
