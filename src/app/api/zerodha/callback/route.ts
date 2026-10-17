import type { NextRequest } from "next/server";
import { errorFields, logger } from "@/lib/logger";
import { currentKiteOwner, kiteCookie, redirectTo } from "@/lib/zerodha/access";
import { createSession } from "@/lib/zerodha/client";
import { KiteError } from "@/lib/zerodha/kite";
import { KITE_SESSION_COOKIE, KITE_STATE_COOKIE, kiteTokenExpiry, sameState, sealKiteSession } from "@/lib/zerodha/session";

/**
 * Kite's redirect after login (register this URL in the Kite developer console). Checks the login
 * state, swaps the request token for the day's access token and keeps it in the encrypted cookie.
 */
export async function GET(request: NextRequest) {
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });
  const back = (result: string) => {
    const response = redirectTo(`/markets?zerodha=${result}`);
    response.cookies.set(KITE_STATE_COOKIE, "", { path: "/api/zerodha", maxAge: 0 });
    return response;
  };

  const params = request.nextUrl.searchParams;
  if (!sameState(params.get("state"), request.cookies.get(KITE_STATE_COOKIE)?.value)) return back("expired");
  const requestToken = params.get("request_token");
  if (!requestToken || (params.has("status") && params.get("status") !== "success")) return back("cancelled");

  try {
    const login = await createSession(owner.config, requestToken);
    const expiresAt = kiteTokenExpiry(Date.now());
    const sealed = sealKiteSession(
      { userId: owner.userId, kiteUserId: login.userId, kiteUserName: login.userName, accessToken: login.accessToken, expiresAt },
      owner.config.sessionSecret,
    );
    const response = back("connected");
    response.cookies.set(KITE_SESSION_COOKIE, sealed, kiteCookie(new Date(expiresAt)));
    logger.info("zerodha.connected", { userId: owner.userId, kiteUserId: login.userId });
    return response;
  } catch (error) {
    logger.error("zerodha.login.failed", error instanceof KiteError ? { status: error.status, errorType: error.errorType, error: error.message } : errorFields(error));
    return back("failed");
  }
}
