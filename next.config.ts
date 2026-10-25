import type { NextConfig } from "next";

/**
 * The old journal tools (formerly TrustSVAN) and the Zerodha track record are switched off: the site
 * is the prop firm only, and /journal is now the evaluation accounts' own journal. Their code stays
 * in the repo; delete these redirects to bring them back.
 */
const JOURNAL_APP = ["upload", "reports", "analytics", "feed", "communities", "inbox", "network", "invite", "track"];
const JOURNAL_PUBLIC = ["explore", "p", "examples"];

const nextConfig: NextConfig = {
  // Next.js blocks cross-origin development resources by default. Do not use a
  // wildcard: preview hosts must be explicitly configured, and this does not
  // change production CORS or authentication behavior.
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.NEXT_DEV_ALLOWED_ORIGIN ? [process.env.NEXT_DEV_ALLOWED_ORIGIN] : []),
  ],
  redirects() {
    return [
      ...JOURNAL_APP.map((path) => ({ source: `/${path}/:rest*`, destination: "/dashboard", permanent: false })),
      ...JOURNAL_PUBLIC.map((path) => ({ source: `/${path}/:rest*`, destination: "/", permanent: false })),
      // The role picker and journal-profile set-up; /onboarding/continue stays.
      { source: "/onboarding", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
