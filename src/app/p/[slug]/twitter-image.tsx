import { renderShareCard } from "./share-card";

// Same card as opengraph-image; see that file for why these are Node + dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const alt = "TrustSVAN research profile: published record source, coverage and risk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareCard(slug);
}
