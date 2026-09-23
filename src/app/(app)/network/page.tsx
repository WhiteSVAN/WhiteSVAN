import { redirect } from "next/navigation";

/** Trader discovery lives in one canonical directory; old links keep their filters. */
export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of [value].flat()) if (typeof v === "string") qs.append(key, v);
  }
  const query = qs.toString();
  redirect(query ? `/explore?${query}` : "/explore");
}
