import type { NextRequest } from "next/server";
import { errorFields, logger } from "@/lib/logger";
import { currentKiteOwner, redirectTo, sameOriginPost } from "@/lib/zerodha/access";
import { endSession } from "@/lib/zerodha/client";
import { dropKiteSession, sharedKiteSession } from "@/lib/zerodha/connection";

/** Disconnect the shared login for everyone: end the Kite session (best effort) and forget it. Owners only, same-origin form posts only. */
export async function POST(request: NextRequest) {
  if (!sameOriginPost(request)) return new Response("Forbidden", { status: 403 });
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });

  const session = await sharedKiteSession(owner.config.sessionSecret);
  if (session) {
    try {
      await endSession(owner.config, session.accessToken);
    } catch (error) {
      logger.warn("zerodha.logout.failed", errorFields(error));
    }
  }
  await dropKiteSession(owner.config.sessionSecret);
  logger.info("zerodha.disconnected", { userId: owner.userId });
  return redirectTo("/markets?zerodha=disconnected", 303);
}
