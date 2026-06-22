/**
 * TrustSVAN brand lockup — swan mark + wordmark.
 *
 * The swan is an inline SVG placeholder so nothing is ever broken. To use the
 * exact brand asset, drop it at public/images/svan-logo.(svg|png) and swap the
 * <svg> below for an <Image src="/images/svan-logo.svg" .. />.
 */
export function SvanLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <SwanMark className="h-6 w-6 text-slate-100" />
      <span className="text-sm font-semibold tracking-[0.16em] text-slate-100">
        Trust<span className="text-cyan-300">SVAN</span>
      </span>
    </span>
  );
}

export function SwanMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* body */}
      <ellipse cx="29" cy="43" rx="19" ry="10.5" fill="currentColor" />
      {/* neck */}
      <path
        d="M40 42C35 30 36.5 17 45 12c3.6-2.1 7 .7 5.3 4.3-1.5-2.6-4.7-2-6 1.3-2.1 5.6-1.2 12.4 1.7 18z"
        fill="currentColor"
      />
      {/* head */}
      <circle cx="47.5" cy="12.5" r="4" fill="currentColor" />
      {/* beak */}
      <path d="M51.5 11l6.5 1.6-6.5 2.2z" fill="#22d3ee" />
    </svg>
  );
}
