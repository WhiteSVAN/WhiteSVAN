const NOTICES: Record<string, { text: string; tone: "ok" | "error" }> = {
  connected: { text: "Zerodha connected. Kite ends every session at 6 AM IST, so you'll log in again each trading day.", tone: "ok" },
  disconnected: { text: "Zerodha disconnected.", tone: "ok" },
  ended: { text: "Your Zerodha session ended. Kite logs everyone out at 6 AM IST, so log in again to keep trading.", tone: "error" },
  cancelled: { text: "The Zerodha login was cancelled.", tone: "error" },
  expired: { text: "That Zerodha login took too long or started in another browser. Try again.", tone: "error" },
  failed: { text: "Zerodha didn't accept the login. Check KITE_API_KEY and KITE_API_SECRET, and the redirect URL in the Kite developer console.", tone: "error" },
};

/** The result of a Kite login round trip (`?zerodha=`), if any. */
export function ZerodhaNotice({ code }: { code: string | undefined }) {
  const notice = NOTICES[code ?? ""];
  if (!notice) return null;
  return <p role="status" className={`rounded-lg border p-4 text-sm ${notice.tone === "ok" ? "border-[var(--primary)]/40 text-[var(--primary)]" : "border-[var(--danger)]/40 text-[var(--danger)]"}`}>{notice.text}</p>;
}
