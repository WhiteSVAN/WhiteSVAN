/**
 * Share-card image for /p/[slug] (Open Graph + Twitter). Rendered with
 * next/og's ImageResponse in the Node.js runtime because it reads Prisma.
 *
 * Guardrails: the card states source and coverage; a period return is shown
 * only together with max drawdown, only when performance isn't hidden, and
 * always with the past-performance line. Private or missing profiles get a
 * generic card that reveals nothing about the trader.
 */
import { ImageResponse } from "next/og";
import { optionLabels } from "@/lib/profile-options";
import { coverageLabel, toRecordContext } from "@/lib/record-context";
import { hiddenSectionSet, pairedFigures, truncate } from "@/lib/profile-page";
import { getLatestVersionWithDrawdown, getProfileBySlug } from "./data";

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

const BG = "#0b0f0d";
const CARD = "linear-gradient(135deg, #172018 0%, #0e1410 100%)";
const ACCENT = "#baf277";
const TEXT = "#e8eee3";
const MUTED = "#a5b497";
const DIM = "#7d8a78";
const DISCLAIMER = "Past performance does not guarantee future results.";

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 8, height: 16, background: ACCENT, opacity: 0.55 }} />
        <div style={{ width: 8, height: 30, background: ACCENT }} />
        <div style={{ width: 8, height: 22, background: ACCENT, opacity: 0.75 }} />
      </div>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 1, color: TEXT }}>TrustSVAN</div>
    </div>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BG,
        padding: 36,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundImage: CARD,
          border: "1px solid #2b3a2c",
          borderRadius: 18,
          padding: "44px 52px",
          color: TEXT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Brand />
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>
            {label}
          </div>
        </div>
        {children}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #2b3a2c",
            paddingTop: 18,
            fontSize: 20,
            color: DIM,
          }}
        >
          <div style={{ display: "flex" }}>{DISCLAIMER}</div>
          <div style={{ display: "flex" }}>Not investment advice</div>
        </div>
      </div>
    </div>
  );
}

function GenericCard() {
  return (
    <Frame label="Proof terminal">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
          Published trading records
        </div>
        <div style={{ display: "flex", fontSize: 30, color: MUTED, lineHeight: 1.35 }}>
          Source, coverage, drawdowns and version history — shown as facts, never as rankings.
        </div>
      </div>
    </Frame>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        border: "1px solid #2b3a2c",
        borderRadius: 12,
        padding: "14px 22px",
        background: "#111711",
      }}
    >
      <div style={{ display: "flex", fontSize: 17, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: TEXT }}>{value}</div>
    </div>
  );
}

export async function renderShareCard(slug: string): Promise<ImageResponse> {
  const profile = await getProfileBySlug(slug);
  if (!profile || !profile.isPublic) {
    return new ImageResponse(<GenericCard />, SHARE_CARD_SIZE);
  }

  const latest = await getLatestVersionWithDrawdown(profile.id);
  const record = latest ? toRecordContext(latest) : null;
  const hidden = hiddenSectionSet(profile.hiddenSections);
  const figures = latest
    ? pairedFigures({
        performanceHidden: hidden.has("performance"),
        returnPct: latest.returnPct,
        maxDrawdownPct: latest.maxDrawdownPct,
      })
    : null;
  const markets = optionLabels("markets", profile.markets).slice(0, 4);
  const headline = profile.headline?.trim() || profile.strategy?.trim() || null;

  return new ImageResponse(
    (
      <Frame label="Research profile">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>
            {truncate(profile.displayName, 36)}
          </div>
          {headline && (
            <div style={{ display: "flex", fontSize: 28, color: MUTED, lineHeight: 1.3 }}>{truncate(headline, 90)}</div>
          )}
          {markets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
              {markets.map((m) => (
                <div
                  key={m}
                  style={{
                    display: "flex",
                    fontSize: 20,
                    color: TEXT,
                    border: "1px solid #3a4a3b",
                    borderRadius: 999,
                    padding: "4px 14px",
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 17, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
              Record source
            </div>
            <div style={{ display: "flex", fontSize: 26, color: TEXT }}>{record ? record.source : "No published record yet"}</div>
            {record && (
              <div style={{ display: "flex", fontSize: 21, color: DIM }}>
                {`${coverageLabel(record)} · version ${record.versionNumber}`}
              </div>
            )}
            {record && <div style={{ display: "flex", fontSize: 21, color: DIM }}>{record.reviewStatus}</div>}
          </div>
          {figures && (
            <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
              <Stat label="Period return" value={figures.periodReturn} />
              <Stat label="Max drawdown" value={figures.maxDrawdown} />
            </div>
          )}
        </div>
      </Frame>
    ),
    SHARE_CARD_SIZE,
  );
}
