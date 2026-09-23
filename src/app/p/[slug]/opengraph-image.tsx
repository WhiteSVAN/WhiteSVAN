import { renderShareCard } from "./share-card";

// Reads Prisma, so it must run on Node.js, and it must never serve a cached card
// after a trader goes private or hides performance.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const alt = "TrustSVAN research profile: published record source, coverage and risk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareCard(slug);
}
