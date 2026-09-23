export default function LoadingExplore() {
  return (
    <div className="min-h-full bg-zinc-950" aria-busy="true" aria-label="Loading public records">
      <div className="h-8 border-b border-[#202a23] bg-[#111711]" />
      <div className="h-[68px] border-b border-zinc-800 sm:h-[76px]" />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-8">
        <div className="h-40 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
        <div className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
          <div className="h-72 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
