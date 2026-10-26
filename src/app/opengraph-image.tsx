import { ImageResponse } from "next/og";
import { EVALUATION_PLANS, PROGRAMME_RULES as R } from "@/lib/prop-firm";

export const alt = "WhiteSVAN: get funded trading NIFTY, BANK NIFTY and SENSEX options";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The Black theme (globals.css): images can't read CSS tokens, so these mirror them. */
const BG = "#0a0a0b";
const CARD = "radial-gradient(ellipse at 90% 0%, rgba(186, 242, 119, 0.10) 0%, rgba(18, 18, 20, 1) 55%)";
const ACCENT = "#baf277";
const TEXT = "#f1f0ec";
const MUTED = "#a3a29d";
const DIM = "#86857f";
const LINE = "#232326";
const PANEL = "#121214";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];
const STATS: [string, string][] = [
  [`${FIRST.label}–${LAST.label}`, "Account sizes"],
  [`${R.contractorSharePercent}%`, "Profit split"],
  [`${R.targetPercent}%`, "Profit target"],
  ["On demand", "Payouts"],
];

/** Storefront share card; every route without its own card uses it. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, padding: 36, fontFamily: "sans-serif" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundImage: CARD,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "44px 52px",
            color: TEXT,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 16, background: ACCENT, opacity: 0.55 }} />
                <div style={{ width: 8, height: 30, background: ACCENT }} />
                <div style={{ width: 8, height: 22, background: ACCENT, opacity: 0.75 }} />
              </div>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>WhiteSVAN</div>
            </div>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>India&apos;s options prop firm</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>
              <div style={{ display: "flex" }}>Pass. Get funded.</div>
              <div style={{ display: "flex", color: ACCENT }}>Get paid.</div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED, lineHeight: 1.35 }}>
              The prop firm for NIFTY, BANK NIFTY and SENSEX options.
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              {STATS.map(([value, label]) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 20px", background: PANEL }}>
                  <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>{value}</div>
                  <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 16, fontSize: 19, color: DIM }}>
            <div style={{ display: "flex" }}>Simulated evaluation and funded accounts</div>
            <div style={{ display: "flex" }}>Not investment advice</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
