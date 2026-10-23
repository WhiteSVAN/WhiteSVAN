import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { loadDirectory } from "./directory";
import { computeTrustMetrics } from "./trust";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

/** Explicitly restricted to the disposable database; never creates fixtures in production. */
describe.skipIf(!localDb)("directory (PostgreSQL integration)", () => {
  const users: string[] = [];
  let profileId = "";
  let privateId = "";
  let viewerId = "";
  let ownerId = "";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const owner = await prisma.user.create({ data: { email: `owner-${suffix}@example.test`, role: "TRADER" } });
    const viewer = await prisma.user.create({ data: { email: `viewer-${suffix}@example.test`, role: "CLIENT" } });
    const hidden = await prisma.user.create({ data: { email: `private-${suffix}@example.test`, role: "TRADER" } });
    users.push(owner.id, viewer.id, hidden.id);
    ownerId = owner.id; viewerId = viewer.id;
    const profile = await prisma.traderProfile.create({ data: { userId: owner.id, slug: `public-${suffix}`, displayName: "Integration record", isPublic: true, registrationType: "SEBI_RA" } });
    profileId = profile.id;
    privateId = (await prisma.traderProfile.create({ data: { userId: hidden.id, slug: `private-${suffix}`, displayName: "Private record", isPublic: false } })).id;
    const trust = computeTrustMetrics([{ date: "2026-01-02", netPnl: 100 }, { date: "2026-01-05", netPnl: -50 }], 10_000, 2);
    const metrics = JSON.parse(JSON.stringify({ ...trust.metrics, proofLevel: trust.proofLevel, scores: trust.scores, verdict: trust.verdict }));
    await prisma.profileVersion.create({ data: { profileId, versionNumber: 1, metrics, netPnl: 50, transparencyScore: 50, proofLevel: 2, freshnessStatus: "fresh", periodStart: new Date("2026-01-02"), periodEnd: new Date("2026-01-05") } });
    await prisma.watchlistItem.create({ data: { userId: viewer.id, profileId } });
    await prisma.follow.create({ data: { userId: viewer.id, profileId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("loads published snapshots and excludes private profiles", async () => {
    const entries = await loadDirectory(null);
    expect(entries.some(entry => entry.profileId === privateId)).toBe(false);
    const record = entries.find(entry => entry.profileId === profileId)!;
    expect(record.record?.versionNumber).toBe(1);
    expect(record.returnPct).toBeCloseTo(0.005);
    expect(record.following).toBe(false);
    expect(record.watching).toBe(false);
  });
  it("exposes saved and followed state only to its viewer", async () => {
    const own = (await loadDirectory(viewerId)).find(entry => entry.profileId === profileId)!;
    const other = (await loadDirectory(ownerId)).find(entry => entry.profileId === profileId)!;
    expect(own.watching).toBe(true); expect(own.following).toBe(true);
    expect(other.watching).toBe(false); expect(other.following).toBe(false); expect(other.isOwner).toBe(true);
  });
  it("does not expose hidden performance or credentials in cards and comparison data", async () => {
    await prisma.traderProfile.update({ where: { id: profileId }, data: { hiddenSections: ["performance", "credentials"] } });
    const record = (await loadDirectory(viewerId)).find(entry => entry.profileId === profileId)!;
    expect(record.returnPct).toBeNull(); expect(record.maxDrawdownPct).toBeNull();
    expect(record.registrationType).toBeNull(); expect(record.credentialsHidden).toBe(true);
    expect(record.record?.versionNumber).toBe(1);
  });
});
