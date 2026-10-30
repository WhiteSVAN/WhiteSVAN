import { NextResponse, type NextRequest } from "next/server";
import { currentKiteOwner } from "@/lib/zerodha/access";
import { loginUrl } from "@/lib/zerodha/kite";
import { KITE_NEXT_COOKIE, KITE_STATE_COOKIE, newLoginState, safeNextPath } from "@/lib/zerodha/session";

/** Send the owner to Zerodha's login page; Kite returns them to /api/zerodha/callback, then `?next=`. */
export async function GET(request: NextRequest) {
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });
  const state = newLoginState();
  const response = NextResponse.redirect(loginUrl(owner.config.apiKey, state, owner.config.loginUrl));
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/zerodha", maxAge: 600 };
  response.cookies.set(KITE_STATE_COOKIE, state, cookie);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (next) response.cookies.set(KITE_NEXT_COOKIE, next, cookie);
  else response.cookies.set(KITE_NEXT_COOKIE, "", { path: "/api/zerodha", maxAge: 0 });
  return response;
}
