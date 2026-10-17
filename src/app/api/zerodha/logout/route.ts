import type { NextRequest } from "next/server";
import { errorFields, logger } from "@/lib/logger";
import { currentKiteOwner, currentKiteSession, redirectTo, sameOriginPost } from "@/lib/zerodha/access";
import { endSession } from "@/lib/zerodha/client";
import { KITE_SESSION_COOKIE } from "@/lib/zerodha/session";

/** Disconnect: end the Kite session (best effort) and drop the cookie. Same-origin form posts only. */
export async function POST(request: NextRequest) {
  if (!sameOriginPost(request)) return new Response("Forbidden", { status: 403 });
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });

  const session = await currentKiteSession(owner);
  if (session) {
    try {
      await endSession(owner.config, session.accessToken);
    } catch (error) {
      logger.warn("zerodha.logout.failed", errorFields(error));
    }
  }
  const response = redirectTo("/markets?zerodha=disconnected", 303);
  response.cookies.set(KITE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
