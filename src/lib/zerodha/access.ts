/**
 * Who may use the firm's Zerodha connection (server only). The owners in KITE_OWNER_EMAILS connect
 * Kite; every signed-in user reads prices through that shared login (connection.ts). Route
 * handlers answer JSON; pages call these directly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorFields, logger } from "@/lib/logger";
import { isKiteOwner, kiteConfig, type KiteConfig } from "./config";
import { dropKiteSession, PRICES_OFFLINE, sharedKiteSession } from "./connection";
import { KiteError } from "./kite";

export interface KiteOwner {
  userId: string;
  config: KiteConfig;
}

/** The signed-in user if they may connect the firm's Zerodha account; otherwise null. */
export async function currentKiteOwner(): Promise<KiteOwner | null> {
  const config = kiteConfig();
  if (!config) return null;
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isKiteOwner(config, user?.email) ? { userId, config } : null;
}

/** What a Kite call runs with: the configuration and the shared login's access token. */
export interface KiteContext {
  config: KiteConfig;
  accessToken: string;
}

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

/** A JSON error for a failed Kite call: 401 when Kite has ended the shared login (it is forgotten), 400 for a request Kite rejects, 429 when Kite rate-limits, 502 otherwise. */
export async function kiteFailure(name: string, error: unknown, context: KiteContext): Promise<Response> {
  if (error instanceof KiteError && error.sessionEnded) {
    await dropKiteSession(context.config.sessionSecret, context.accessToken);
    return Response.json({ error: "session", message: PRICES_OFFLINE }, { status: 401, headers: NO_STORE });
  }
  if (error instanceof KiteError && error.errorType === "InputException") {
    return Response.json({ error: "input", message: error.message }, { status: 400, headers: NO_STORE });
  }
  if (error instanceof KiteError && error.status === 429) {
    return Response.json({ error: "rate_limited", message: "The price feed is busy. Retrying shortly." }, { status: 429, headers: NO_STORE });
  }
  logger.error(`zerodha.${name}.failed`, error instanceof KiteError ? { status: error.status, errorType: error.errorType, error: error.message } : errorFields(error));
  const message = error instanceof KiteError ? error.message : "Something went wrong loading prices.";
  return Response.json({ error: "upstream", message }, { status: 502, headers: NO_STORE });
}

/** A JSON route over the shared Kite login for any signed-in user: 404 with Zerodha off, 401 signed out or offline, then {@link kiteFailure}. */
export async function kiteJson(name: string, run: (context: KiteContext) => Promise<unknown>): Promise<Response> {
  const config = kiteConfig();
  if (!config) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  if (!(await auth())?.user?.id) return Response.json({ error: "signed_out", message: "Sign in to load prices." }, { status: 401, headers: NO_STORE });
  const session = await sharedKiteSession(config.sessionSecret);
  if (!session) return Response.json({ error: "session", message: PRICES_OFFLINE }, { status: 401, headers: NO_STORE });
  const context = { config, accessToken: session.accessToken };
  try {
    return Response.json(await run(context), { headers: NO_STORE });
  } catch (error) {
    return kiteFailure(name, error, context);
  }
}
