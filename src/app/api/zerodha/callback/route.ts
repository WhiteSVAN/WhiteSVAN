import type { NextRequest } from "next/server";
import { errorFields, logger } from "@/lib/logger";
import { currentKiteOwner, redirectTo } from "@/lib/zerodha/access";
import { createSession } from "@/lib/zerodha/client";
import { saveKiteSession } from "@/lib/zerodha/connection";
import { KiteError } from "@/lib/zerodha/kite";
import { KITE_NEXT_COOKIE, KITE_STATE_COOKIE, kiteTokenExpiry, safeNextPath, sameState } from "@/lib/zerodha/session";

/**
 * Kite's redirect after login (register this URL in the Kite developer console). Checks the login
 * state, swaps the request token for the day's access token and stores it, sealed, as the shared
 * login every signed-in user's prices come from.
 */
export async function GET(request: NextRequest) {
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });
  const next = safeNextPath(request.cookies.get(KITE_NEXT_COOKIE)?.value) ?? "/markets";
  const back = (result: string) => {
    const response = redirectTo(`${next}${next.includes("?") ? "&" : "?"}feed=${result}`);
    response.cookies.set(KITE_STATE_COOKIE, "", { path: "/api/zerodha", maxAge: 0 });
    response.cookies.set(KITE_NEXT_COOKIE, "", { path: "/api/zerodha", maxAge: 0 });
    return response;
  };

  const params = request.nextUrl.searchParams;
  if (!sameState(params.get("state"), request.cookies.get(KITE_STATE_COOKIE)?.value)) return back("expired");
  const requestToken = params.get("request_token");
  if (!requestToken || (params.has("status") && params.get("status") !== "success")) return back("cancelled");

  try {
    const login = await createSession(owner.config, requestToken);
    const expiresAt = kiteTokenExpiry(Date.now());
    await saveKiteSession(
      { userId: owner.userId, kiteUserId: login.userId, kiteUserName: login.userName, accessToken: login.accessToken, expiresAt },
      owner.config.sessionSecret,
    );
    logger.info("zerodha.connected", { userId: owner.userId, kiteUserId: login.userId });
    return back("connected");
  } catch (error) {
    logger.error("zerodha.login.failed", error instanceof KiteError ? { status: error.status, errorType: error.errorType, error: error.message } : errorFields(error));
    return back("failed");
  }
}
