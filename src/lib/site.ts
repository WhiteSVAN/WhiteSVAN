import { EVALUATION_PLANS } from "./prop-firm";

/** Canonical public origin for metadata, the sitemap and robots. Set NEXT_PUBLIC_SITE_URL for a custom domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://white-svan.vercel.app").replace(/\/+$/, "");

/** Storefront pages listed in the sitemap, most important first. */
export const PUBLIC_PAGES: readonly { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/evaluations", priority: 0.9 },
  ...EVALUATION_PLANS.map((plan) => ({ path: `/evaluations/${plan.id}`, priority: 0.8 })),
  { path: "/how-it-works", priority: 0.8 },
  { path: "/funded", priority: 0.8 },
  { path: "/rules", priority: 0.8 },
  { path: "/academy", priority: 0.7 },
  { path: "/help", priority: 0.6 },
];

/** Signed-in workspace routes; crawlers are asked to skip them. */
export const PRIVATE_PATHS = [
  "/analytics", "/communities", "/dashboard", "/feed", "/inbox", "/invite", "/journal", "/markets",
  "/network", "/onboarding", "/payouts", "/reports", "/settings", "/upload", "/api/",
] as const;
