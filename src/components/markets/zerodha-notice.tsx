const NOTICES: Record<string, { text: string; tone: "ok" | "error" }> = {
  connected: { text: "Live prices are on for everyone. The connection ends at 6 AM IST, so connect again each trading day.", tone: "ok" },
  disconnected: { text: "Live prices are off for everyone until an owner connects again.", tone: "ok" },
  ended: { text: "The price feed connection ended (it ends at 6 AM IST each day). Connect again to bring prices back.", tone: "error" },
  cancelled: { text: "The connection was cancelled.", tone: "error" },
  expired: { text: "That connection took too long or started in another browser. Try again.", tone: "error" },
  failed: { text: "The connection failed. Check the price feed's API key, secret and redirect URL.", tone: "error" },
};

/** The result of a price-feed login round trip, or of the shared login ending (`?feed=`), if any. */
export function ZerodhaNotice({ code }: { code: string | undefined }) {
  const notice = NOTICES[code ?? ""];
  if (!notice) return null;
  return <p role="status" className={`rounded-lg border p-4 text-sm ${notice.tone === "ok" ? "border-[var(--primary)]/40 text-[var(--primary)]" : "border-[var(--danger)]/40 text-[var(--danger)]"}`}>{notice.text}</p>;
}
