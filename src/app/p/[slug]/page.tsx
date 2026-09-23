import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Lock, Pencil } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { SiteFooter } from "@/components/site-footer";
import { RecordBadge } from "@/components/record-badge";
import { FollowButtons } from "@/components/network/follow-buttons";
import { RequestConversation } from "@/components/inquiries/request-conversation";
import { ProfileTabs } from "@/components/portal/profile-tabs";
import { optionLabel, optionLabels } from "@/lib/profile-options";
import { coverageLabel, toRecordContext } from "@/lib/record-context";
import { recordProfileView } from "@/lib/profile-views";
import {
  parseTab,
  parseVersionParam,
  profileDescription,
  profileHref,
  resolveSiteOrigin,
  yearsTradingLabel,
} from "@/lib/profile-page";
import { getFollowState, getLatestVersion, getViewableProfile } from "./data";
import { OverviewTab } from "./overview-tab";
import { PerformanceTab } from "./performance-tab";
import { ProofTab } from "./proof-tab";
import { PostsTab } from "./posts-tab";
import { PrintButton } from "./print-button";
import { ShareLinkButton } from "./share-link-button";
import { FollowForm } from "./follow-form";

const DEFAULT_DISCLAIMER =
  "TrustSVAN is research, analytics, and professional networking software. It does not manage money, execute trades, or provide investment advice. Past performance does not guarantee future results.";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  return resolveSiteOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL,
    vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [view, origin] = await Promise.all([getViewableProfile(slug), siteOrigin()]);
  const base: Metadata = origin ? { metadataBase: new URL(origin) } : {};

  if (!view) {
    return {
      ...base,
      title: "Research profile unavailable — TrustSVAN",
      robots: { index: false, follow: false },
    };
  }

  const { profile } = view;
  if (!profile.isPublic) {
    // Owner preview of a private profile: never indexable, no share metadata.
    return { ...base, title: `${profile.displayName} (private preview) — TrustSVAN`, robots: { index: false, follow: false } };
  }

  const latest = await getLatestVersion(profile.id);
  const record = latest ? toRecordContext(latest) : null;
  const title = `${profile.displayName} — TrustSVAN research profile`;
  const description = profileDescription({
    displayName: profile.displayName,
    headline: profile.headline,
    strategy: profile.strategy,
    source: record?.source ?? null,
    coverage: record ? coverageLabel(record) : null,
  });
  const url = profileHref(profile.slug);

  return {
    ...base,
    title,
    description,
    alternates: { canonical: url },
    // Images come from the colocated opengraph-image / twitter-image routes.
    openGraph: { type: "profile", title, description, url, siteName: "TrustSVAN" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

function Unavailable() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-16 text-center">
      <div>
        <p className="text-lg font-semibold text-white">This research profile isn&apos;t available</p>
        <p className="mt-1 text-sm text-zinc-400">
          The link may be wrong, or the trader has set their profile to private.
        </p>
        <Link href="/explore" className="mt-4 inline-block text-sm text-[#baf277] hover:underline">
          Explore published records
        </Link>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full border border-zinc-700 bg-zinc-900/70 px-2.5 py-0.5 text-xs text-zinc-300">
      {children}
    </li>
  );
}

export default async function PortalPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const view = await getViewableProfile(slug);
  if (!view) return <Unavailable />;

  const { profile, viewerId, isOwner } = view;
  const tab = parseTab(sp.tab);
  const requestedVersion = tab === "proof" ? parseVersionParam(sp.v) : null;

  const [latest, follow] = await Promise.all([
    getLatestVersion(profile.id),
    getFollowState(profile.id, viewerId),
    profile.isPublic ? recordProfileView(profile.id, profile.userId, viewerId) : Promise.resolve(),
  ]);
  const record = latest ? toRecordContext(latest) : null;

  const chips = [
    ...optionLabels("markets", profile.markets),
    ...optionLabels("strategyTags", profile.strategyTags),
    optionLabel("regions", profile.region),
    yearsTradingLabel(profile.experienceYears),
    profile.capitalBand ? `Capital ${optionLabel("capitalBands", profile.capitalBand)}` : null,
  ].filter((c): c is string => !!c);

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e] print:hidden">
        <div className="mx-auto flex h-8 max-w-4xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2">
            <i className="terminal-dot" /> Published record
          </span>
          <span className="truncate">Immutable snapshots / operator controlled</span>
        </div>
      </div>

      <nav className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl print:hidden" aria-label="Site">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <Link href={viewerId ? "/dashboard" : "/"} className="text-xl font-semibold text-zinc-100" aria-label="TrustSVAN home">
            <SvanLogo />
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/explore" className="text-zinc-200 hover:text-white">
              Explore
            </Link>
            {viewerId ? (
              <Link href="/dashboard" className="text-zinc-400 hover:text-white">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="text-zinc-400 hover:text-white">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {isOwner && (
        <div
          className={`border-b print:hidden ${
            profile.isPublic ? "border-[#2b3a2c] bg-[#111711]" : "border-zinc-600 bg-zinc-800/70"
          }`}
          role="status"
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs">
            {profile.isPublic ? (
              <span className="text-[#cfe3bd]">This is your public profile</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-white">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Private — only you can see this. Visitors get a &ldquo;not available&rdquo; page.
              </span>
            )}
            <Link href="/settings" className="inline-flex items-center gap-1 font-medium text-[#baf277] hover:underline">
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Edit in Settings
            </Link>
          </div>
        </div>
      )}

      <header className="terminal-grid border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
          <p className="terminal-label">Research profile</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-3xl font-medium tracking-[-0.045em] text-white sm:text-4xl">
              {profile.displayName}
            </h1>
            {profile.openToWork && (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300/40 bg-zinc-300/10 px-2 py-0.5 text-xs font-medium text-zinc-100">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-200" aria-hidden="true" />
                Open to work
              </span>
            )}
          </div>
          {profile.headline && (
            <p className="mt-2 break-words text-sm font-medium text-zinc-300">{profile.headline}</p>
          )}

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Markets, strategy and background">
              {chips.map((c, i) => (
                <Chip key={`${i}-${c}`}>{c}</Chip>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <RecordBadge record={record} slug={profile.slug} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
            {profile.isPublic &&
              (isOwner ? (
                <span className="font-mono text-[10px] text-zinc-500">
                  {follow.followerCount} follower{follow.followerCount === 1 ? "" : "s"}
                </span>
              ) : (
                <FollowButtons
                  profileId={profile.id}
                  following={follow.following}
                  watching={follow.watching}
                  followerCount={follow.followerCount}
                  signedIn={!!viewerId}
                />
              ))}
            <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {latest && !view.hidden.has("performance") && (
                <Link
                  href={`${profileHref(profile.slug)}/diligence`}
                  className="inline-flex min-h-9 items-center rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-400 hover:text-white"
                >
                  Diligence summary
                </Link>
              )}
              {profile.isPublic && <ShareLinkButton path={profileHref(profile.slug)} />}
              <PrintButton />
            </span>
          </div>

          {profile.isPublic && (
            <div className="mt-5 print:hidden">
              <RequestConversation profileId={profile.id} viewerId={viewerId} />
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-4">
        <ProfileTabs slug={profile.slug} active={tab} />
      </div>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {tab === "overview" && <OverviewTab view={view} latest={latest} />}
        {tab === "performance" && <PerformanceTab view={view} latest={latest} />}
        {tab === "proof" && <ProofTab view={view} latest={latest} requestedVersion={requestedVersion} />}
        {tab === "posts" && <PostsTab view={view} />}

        {!viewerId && profile.isPublic && (
          <section className="terminal-card space-y-3 p-5 print:hidden" aria-labelledby="email-updates-heading">
            <h2 id="email-updates-heading" className="text-base font-medium text-white">
              Email updates
            </h2>
            <p className="text-sm text-zinc-400">
              Get an email when {profile.displayName} republishes this record. Have an account?{" "}
              <Link href="/login" className="text-[#baf277] hover:underline">
                Sign in to follow
              </Link>{" "}
              instead.
            </p>
            <FollowForm slug={profile.slug} />
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-xs leading-relaxed text-zinc-400">
          {profile.disclaimer && <p className="whitespace-pre-line break-words">{profile.disclaimer}</p>}
          <p>{DEFAULT_DISCLAIMER}</p>
        </div>
      </footer>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
