import Link from "next/link";
import { PROFILE_TABS, profileHref, type ProfileTab } from "@/lib/profile-page";

/**
 * Server-rendered tab bar for /p/[slug]. Tabs are plain links (`?tab=`), so each
 * tab is shareable and works without JavaScript. Scrolls sideways on narrow
 * screens instead of widening the page.
 */
export function ProfileTabs({ slug, active }: { slug: string; active: ProfileTab }) {
  return (
    <nav aria-label="Profile sections" className="border-b border-zinc-800 print:hidden">
      <ul className="-mb-px flex min-w-0 gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        {PROFILE_TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={profileHref(slug, tab.key)}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition ${
                  current
                    ? "border-[#baf277] text-white"
                    : "border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
