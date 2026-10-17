import { NextResponse } from "next/server";
import { currentKiteOwner } from "@/lib/zerodha/access";
import { loginUrl } from "@/lib/zerodha/kite";
import { KITE_STATE_COOKIE, newLoginState } from "@/lib/zerodha/session";

/** Send the owner to Zerodha's login page; Kite returns them to /api/zerodha/callback. */
export async function GET() {
  const owner = await currentKiteOwner();
  if (!owner) return new Response("Not found", { status: 404 });
  const state = newLoginState();
  const response = NextResponse.redirect(loginUrl(owner.config.apiKey, state, owner.config.loginUrl));
  response.cookies.set(KITE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/zerodha",
    maxAge: 600,
  });
  return response;
}
