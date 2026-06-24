/**
 * Broker-connection catalog for the "Linking {broker}" modals on the broker-
 * connection page. Modeled on Kinfo's per-broker linking guides, which fall into
 * four read-only mechanism families (plus a statement-upload fallback):
 *
 *  - flex      → Interactive Brokers' official Flex Web Service (email enable + token)
 *  - oauth     → broker's own API; a read-only OAuth handshake (Schwab, Tradier, …)
 *  - snaptrade → SnapTrade aggregator; login on SnapTrade's hosted form (Robinhood, …)
 *  - clearing  → read-only clearing-firm client login (Guardian/Velocity, Cobra, …)
 *  - upload    → no connector yet; load a statement/export via the bridge below
 *
 * Flow copy is generated from the mechanism + broker name so adding a broker is a
 * one-line entry. The flex flow (IBKR) is the only one with bespoke UI, handled in
 * the modal. Everything here is pure data — no integration is wired yet (UI pass).
 */

export type Mechanism = "flex" | "oauth" | "snaptrade" | "clearing" | "upload";

export interface BrokerConnection {
  id: string;
  name: string;
  mechanism: Mechanism;
  /** Clearing-firm shown in the flow (clearing mechanism only). */
  clearingFirm?: string;
  /** Extra broker-specific note rendered in the modal. */
  note?: string;
}

// IBKR's third-party reporting integration inbox (read-only Flex Web Service).
export const IB_REPORTING_EMAIL = "reportingintegration@interactivebrokers.com";

// Placeholder support address — swap for the real one when integrations land.
export const SUPPORT_EMAIL = "support@trustsvan.com";

/** Preformatted IBKR enablement email (drafted by the "Generate email to IB" button). */
export function ibEmailHref(): string {
  const subject = "Enable read-only Flex Web Service (third-party reporting) — TrustSVAN";
  const body = [
    "Hello Interactive Brokers team,",
    "",
    "Please enable read-only third-party reporting (Flex Web Service) on my account so I",
    "can connect it to TrustSVAN for verified, read-only performance reporting.",
    "",
    "IB account number: __________",
    "",
    "Please backfill my trade history since inception. I understand this access is",
    "read-only and cannot be used to place trades or move funds.",
    "",
    "Thank you,",
  ].join("\n");
  return `mailto:${IB_REPORTING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The supported brokers, grouped into the mechanism families below. IBKR first. */
export const BROKER_CONNECTIONS: BrokerConnection[] = [
  // Interactive Brokers — Flex Web Service.
  { id: "ibkr", name: "Interactive Brokers", mechanism: "flex" },

  // Direct API (OAuth).
  { id: "schwab", name: "Charles Schwab", mechanism: "oauth" },
  { id: "tdameritrade", name: "TD Ameritrade · thinkorswim", mechanism: "oauth" },
  { id: "tradier", name: "Tradier", mechanism: "oauth" },
  { id: "tradestation", name: "TradeStation", mechanism: "oauth" },

  // Via SnapTrade.
  { id: "robinhood", name: "Robinhood", mechanism: "snaptrade" },
  { id: "fidelity", name: "Fidelity", mechanism: "snaptrade" },
  {
    id: "etrade",
    name: "E*TRADE",
    mechanism: "snaptrade",
    note: "E*TRADE doesn't support auto-sync — refresh on demand with Sync Now.",
  },
  { id: "webull", name: "Webull", mechanism: "snaptrade" },
  { id: "tastytrade", name: "tastytrade", mechanism: "snaptrade" },

  // Clearing-firm read-only login.
  { id: "guardian", name: "Guardian Trading", mechanism: "clearing", clearingFirm: "Velocity Clearing" },
  { id: "cobra", name: "Cobra Trading", mechanism: "clearing", clearingFirm: "your clearing firm" },
  { id: "centerpoint", name: "CenterPoint Securities", mechanism: "clearing", clearingFirm: "your clearing firm" },
  { id: "lightspeed", name: "Lightspeed", mechanism: "clearing", clearingFirm: "your clearing firm" },
  { id: "tradezero", name: "TradeZero", mechanism: "clearing", clearingFirm: "your clearing firm" },

  // Statement / export upload (connector not built yet).
  { id: "ninjatrader", name: "NinjaTrader", mechanism: "upload" },
  { id: "tradovate", name: "Tradovate", mechanism: "upload" },
  { id: "amp", name: "AMP Futures", mechanism: "upload" },
  { id: "mt5", name: "MetaTrader 5", mechanism: "upload" },
  { id: "propreports", name: "PropReports", mechanism: "upload" },
];

interface MechanismGroup {
  mechanism: Mechanism;
  title: string;
  subtitle: string;
}

/** Display groups for the broker grid, in render order. */
export const MECHANISM_GROUPS: MechanismGroup[] = [
  { mechanism: "flex", title: "Interactive Brokers", subtitle: "Official Flex Web Service — read-only" },
  { mechanism: "oauth", title: "Direct API (OAuth)", subtitle: "Sign in once, approve read-only access" },
  { mechanism: "snaptrade", title: "Via SnapTrade", subtitle: "Secure aggregator — your login never touches TrustSVAN" },
  { mechanism: "clearing", title: "Clearing-firm login", subtitle: "Read-only client login from your clearing firm" },
  { mechanism: "upload", title: "Statement upload", subtitle: "Direct connector coming — load an export for now" },
];

/** Tiny tag shown on each broker tile + in the modal eyebrow. */
export const MECHANISM_TAG: Record<Mechanism, string> = {
  flex: "Flex",
  oauth: "OAuth",
  snaptrade: "SnapTrade",
  clearing: "Clearing",
  upload: "Statement",
};

/** Modal eyebrow line, e.g. "Read-only · Direct API". */
export function mechanismEyebrow(m: Mechanism): string {
  switch (m) {
    case "flex":
      return "Read-only · Flex Web Service";
    case "oauth":
      return "Read-only · Direct API";
    case "snaptrade":
      return "Read-only · via SnapTrade";
    case "clearing":
      return "Read-only · clearing firm";
    case "upload":
      return "Statement upload";
  }
}

/** One-paragraph intro for the modal, generated from mechanism + broker. */
export function introFor(b: BrokerConnection): string {
  switch (b.mechanism) {
    case "flex":
      return `Interactive Brokers verification uses IBKR's official Flex Web Service — a read-only data feed. To enable it, send a one-time request to Interactive Brokers. TrustSVAN can draft the email for you.`;
    case "oauth":
      return `TrustSVAN connects directly to ${b.name} using their official API. A read-only OAuth handshake grants access to your trade history without ever sharing your ${b.name} password with us.`;
    case "snaptrade":
      return `TrustSVAN connects to ${b.name} through SnapTrade, a regulated account-aggregation provider. You authenticate on SnapTrade's secure form — TrustSVAN only ever receives read-only trade history.`;
    case "clearing":
      return `TrustSVAN links ${b.name} through your clearing firm${b.clearingFirm && b.clearingFirm !== "your clearing firm" ? ` (${b.clearingFirm})` : ""}. You sign in with a read-only client login that can only be used to read trade data.`;
    case "upload":
      return `${b.name} connects via statement/export upload while a direct read-only connector is built. Load your ${b.name} export and TrustSVAN verifies it from the same source data.`;
  }
}

/** Ordered steps for the modal, generated from mechanism + broker. */
export function stepsFor(b: BrokerConnection): string[] {
  switch (b.mechanism) {
    case "flex":
      // Step 1 is the email enable; Step 2 (token) is rendered as its own block.
      return [];
    case "oauth":
      return [
        `Click "Connect ${b.name}" — a secure ${b.name} window opens.`,
        `Sign in to ${b.name} and approve read-only access. You may be asked for a verification code (MFA).`,
        `The window closes and TrustSVAN begins importing your verified history.`,
      ];
    case "snaptrade":
      return [
        `Click "Continue to SnapTrade" and pick ${b.name} from the broker list.`,
        `Sign in with your ${b.name} credentials on SnapTrade's secure, hosted form.`,
        `TrustSVAN imports your history read-only and keeps it refreshed.`,
      ];
    case "clearing": {
      const firm = b.clearingFirm ?? "your clearing firm";
      return [
        `Click "Connect ${b.name}".`,
        `Enter your ${firm} client login — this login is read-only.`,
        `Choose a live link or a one-time import.`,
      ];
    }
    case "upload":
      return [
        `Export your trade history from ${b.name}.`,
        `Load the file in the source-history loader below.`,
        `TrustSVAN parses it into verified performance and risk metrics.`,
      ];
  }
}

/** Primary-action button label per mechanism. */
export function actionLabelFor(b: BrokerConnection): string {
  switch (b.mechanism) {
    case "flex":
      return "Generate email to IB";
    case "oauth":
      return `Connect ${b.name}`;
    case "snaptrade":
      return "Continue to SnapTrade";
    case "clearing":
      return `Connect ${b.name}`;
    case "upload":
      return "Load a statement";
  }
}

/**
 * The three read-only guarantees. Lines 2 & 3 are universal; line 1 (about
 * credentials) is mechanism-specific so we never overclaim. "NEVER" is emphasized
 * in the modal.
 */
export function guaranteesFor(b: BrokerConnection): string[] {
  const credentials =
    b.mechanism === "snaptrade"
      ? `Your ${b.name} login is entered on SnapTrade's secure form — TrustSVAN NEVER sees or stores it.`
      : b.mechanism === "clearing"
        ? `Your clearing-firm login is read-only and can NEVER be used to place trades or move funds.`
        : b.mechanism === "upload"
          ? `TrustSVAN reads only the statement you upload — NEVER your live account or login.`
          : `TrustSVAN will NEVER see, store, or access your ${b.name} login credentials.`;
  return [
    credentials,
    "TrustSVAN can NEVER be used to place, execute, or copy trades.",
    "TrustSVAN can NEVER touch your money or assets, or make any changes to your account.",
  ];
}
