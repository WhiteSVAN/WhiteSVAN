import Link from "next/link";
import { EyeOff } from "lucide-react";

/**
 * Placeholder for a public-profile section the trader chose to hide. Visitors
 * see the plain notice; the owner also sees that it's hidden and where to
 * change it.
 */
export function HiddenSection({ title, isOwner }: { title: string; isOwner: boolean }) {
  return (
    <section className="terminal-card border-dashed p-6 text-center" aria-label={title}>
      <p className="terminal-label">{title}</p>
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-300">
        <EyeOff className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        The trader has hidden this section.
      </p>
      {isOwner && (
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-zinc-500">
          Only you see this note: this section is hidden on your public profile.{" "}
          <Link href="/settings" className="text-[#baf277] hover:underline">
            Change in Settings
          </Link>
        </p>
      )}
    </section>
  );
}
