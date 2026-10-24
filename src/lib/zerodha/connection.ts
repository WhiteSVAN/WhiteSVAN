/**
 * The firm's Kite login, shared by every signed-in user (server only). An owner's login stores the
 * day's access token in the KiteConnection row, sealed with AES-256-GCM; charts, quotes and the
 * trading platform read it for everyone until Kite ends it at 06:00 IST. Only the server ever
 * holds the token.
 */
import { prisma } from "@/lib/db";
import { openKiteSession, sealKiteSession, type KiteSession } from "./session";

const ROW_ID = "firm";
/** How long a server instance trusts its last read of the row. */
const REREAD_MS = 10_000;

/** Why prices stopped, under a "Live prices are offline" or "Connect Zerodha again" heading. */
export const PRICES_OFFLINE = "Prices return when the firm's Zerodha login reconnects. Kite ends it at 6 AM IST every day.";

// On globalThis so every route in a server process shares one read, however it was bundled.
const memory = globalThis as unknown as { kiteConnection?: { session: KiteSession | null; readAt: number } };

/** The shared login, or null when no owner has connected since Kite's last 06:00 logout. */
export async function sharedKiteSession(secret: string, now = Date.now()): Promise<KiteSession | null> {
  const known = memory.kiteConnection;
  if (known && now - known.readAt < REREAD_MS) return known.session && known.session.expiresAt > now ? known.session : null;
  const row = await prisma.kiteConnection.findUnique({ where: { id: ROW_ID } });
  const session = row ? openKiteSession(row.sealed, secret, row.userId, now) : null;
  memory.kiteConnection = { session, readAt: now };
  return session;
}

export async function saveKiteSession(session: KiteSession, secret: string): Promise<void> {
  const data = { userId: session.userId, sealed: sealKiteSession(session, secret), expiresAt: new Date(session.expiresAt) };
  await prisma.kiteConnection.upsert({ where: { id: ROW_ID }, create: { id: ROW_ID, ...data }, update: data });
  memory.kiteConnection = { session, readAt: Date.now() };
}

/**
 * Forget the login: on disconnect, or when Kite rejects `accessToken`. Given the rejected token, a
 * newer login stored meanwhile survives.
 */
export async function dropKiteSession(secret: string, accessToken?: string): Promise<void> {
  memory.kiteConnection = undefined;
  if (!accessToken) {
    await prisma.kiteConnection.deleteMany({ where: { id: ROW_ID } });
    return;
  }
  const row = await prisma.kiteConnection.findUnique({ where: { id: ROW_ID } });
  if (!row) return;
  // Read at time 0 so an expired login still opens and can be matched.
  const stored = openKiteSession(row.sealed, secret, row.userId, 0);
  if (stored && stored.accessToken !== accessToken) return;
  await prisma.kiteConnection.deleteMany({ where: { id: ROW_ID, sealed: row.sealed } });
}
