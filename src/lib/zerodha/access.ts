/**
 * Who may use the firm's Zerodha connection, and their Kite session (server only). Route handlers
 * answer JSON; pages call these and render a 404 for everyone else.
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorFields, logger } from "@/lib/logger";
import { isKiteOwner, kiteConfig, type KiteConfig } from "./config";
import { KiteError } from "./kite";
import { KITE_SESSION_COOKIE, openKiteSession, type KiteSession } from "./session";

export interface KiteOwner {
  userId: string;
  config: KiteConfig;
}

/** The signed-in user if they may use the firm's Zerodha account; otherwise null. */
export async function currentKiteOwner(): Promise<KiteOwner | null> {
  const config = kiteConfig();
  if (!config) return null;
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isKiteOwner(config, user?.email) ? { userId, config } : null;
}

export async function currentKiteSession(owner: KiteOwner, now = Date.now()): Promise<KiteSession | null> {
  return openKiteSession((await cookies()).get(KITE_SESSION_COOKIE)?.value, owner.config.sessionSecret, owner.userId, now);
}

export const kiteCookie = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/**
 * A redirect within this site. The Location stays relative so the browser keeps the host it used:
 * `request.url` can name another host (the dev server says localhost, proxies rewrite it), and the
 * sign-in cookie would not follow.
 */
export const redirectTo = (path: string, status: 303 | 307 = 307) => new NextResponse(null, { status, headers: { Location: path } });

/** A browser POST from this site: its Origin (or Sec-Fetch-Site) must match the Host it was sent to. */
export function sameOriginPost(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const NO_STORE = { "Cache-Control": "private, no-store" };

/** A JSON error for a failed Kite call: 401 when Zerodha needs a fresh login (the cookie is cleared), 400 for a request Kite rejects, 429 when Kite rate-limits, 502 otherwise. */
export async function kiteFailure(name: string, error: unknown): Promise<Response> {
  if (error instanceof KiteError && error.sessionEnded) {
    (await cookies()).delete(KITE_SESSION_COOKIE);
    return Response.json({ error: "session", message: "Your Zerodha session has ended (Kite logs everyone out at 6 AM). Connect again." }, { status: 401, headers: NO_STORE });
  }
  if (error instanceof KiteError && error.errorType === "InputException") {
    return Response.json({ error: "input", message: error.message }, { status: 400, headers: NO_STORE });
  }
  if (error instanceof KiteError && error.status === 429) {
    return Response.json({ error: "rate_limited", message: "Zerodha is limiting requests. Retrying shortly." }, { status: 429, headers: NO_STORE });
  }
  logger.error(`zerodha.${name}.failed`, error instanceof KiteError ? { status: error.status, errorType: error.errorType, error: error.message } : errorFields(error));
  const message = error instanceof KiteError ? error.message : "Something went wrong loading Zerodha data.";
  return Response.json({ error: "upstream", message }, { status: 502, headers: NO_STORE });
}

/** A JSON route over the owner's Kite session: 404 for anyone else, 401 without a session, then {@link kiteFailure}. */
export async function kiteJson(name: string, run: (context: { config: KiteConfig; accessToken: string }) => Promise<unknown>): Promise<Response> {
  const owner = await currentKiteOwner();
  if (!owner) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  const session = await currentKiteSession(owner);
  if (!session) return Response.json({ error: "session", message: "Connect your Zerodha account to load charts." }, { status: 401, headers: NO_STORE });
  try {
    return Response.json(await run({ config: owner.config, accessToken: session.accessToken }), { headers: NO_STORE });
  } catch (error) {
    return kiteFailure(name, error);
  }
}
