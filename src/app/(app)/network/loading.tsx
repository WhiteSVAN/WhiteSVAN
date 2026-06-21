export default function LoadingNetwork() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-56 animate-pulse rounded-lg bg-slate-100 md:col-span-2" />
        <div className="h-56 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}
