export type ExampleOperator = {
  slug: string;
  displayName: string;
  initials: string;
  location: string;
  strategy: string;
  instruments: string;
  proof: string;
  proofLevel: number;
  returnPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  capitalBand: string;
  trackRecord: string;
  freshness: string;
  riskBudget: string;
  capacityNote: string;
  summary: string;
  process: string[];
  evidence: string[];
  riskNotes: string[];
  equity: number[];
};

export const EXAMPLE_OPERATORS: ExampleOperator[] = [
  {
    slug: "arjun-mehta",
    displayName: "Arjun Mehta",
    initials: "AM",
    location: "Mumbai · India",
    strategy: "Index futures",
    instruments: "NIFTY, BANKNIFTY",
    proof: "Illustrative statement coverage",
    proofLevel: 4,
    returnPct: 28.6,
    sharpe: 1.84,
    maxDrawdownPct: 6.9,
    capitalBand: "$100K–$250K",
    trackRecord: "26 months",
    freshness: "Updated 4 days ago",
    riskBudget: "0.45% per idea",
    capacityNote: "Evidence covers two personal accounts. No claim is made about performance at institutional scale.",
    summary: "Rules-led index futures execution built around opening structure, volatility filters, and a hard daily stop.",
    process: ["Trades two defined session windows", "Pauses after two full-risk losses", "Reviews slippage and rule adherence weekly"],
    evidence: ["Read-only broker history", "24 monthly statements", "Private tax-record attestation"],
    riskNotes: ["Best month contributed 18% of total profit", "Largest drawdown recovered in 31 days"],
    equity: [100, 103, 102, 106, 109, 108, 113, 117, 115, 121, 124, 129],
  },
  {
    slug: "maya-brooks",
    displayName: "Maya Brooks",
    initials: "MB",
    location: "Austin · USA",
    strategy: "Equity swing",
    instruments: "US equities, sector ETFs",
    proof: "Illustrative statement coverage",
    proofLevel: 3,
    returnPct: 21.4,
    sharpe: 1.62,
    maxDrawdownPct: 8.1,
    capitalBand: "$250K–$500K",
    trackRecord: "38 months",
    freshness: "Updated 9 days ago",
    riskBudget: "6% portfolio heat",
    capacityNote: "Liquid large- and mid-cap universe; published record does not test concentrated client constraints.",
    summary: "Multi-day equity swing process using breadth, earnings revisions, and explicit portfolio-heat limits.",
    process: ["Screens liquid factor leaders", "Sizes by volatility and portfolio overlap", "Publishes thesis invalidation before entry"],
    evidence: ["Broker-export reconciliation", "Quarterly statement set", "Trade-note sample reviewed"],
    riskNotes: ["Technology factor concentration reached 42%", "Gap risk remains the primary loss driver"],
    equity: [100, 102, 105, 103, 108, 111, 110, 114, 118, 116, 120, 121],
  },
  {
    slug: "kenji-sato",
    displayName: "Kenji Sato",
    initials: "KS",
    location: "Singapore",
    strategy: "Systematic macro",
    instruments: "Rates, FX, index futures",
    proof: "Illustrative imported history",
    proofLevel: 2,
    returnPct: 17.8,
    sharpe: 1.38,
    maxDrawdownPct: 9.6,
    capitalBand: "$500K–$1M",
    trackRecord: "19 months",
    freshness: "Updated yesterday",
    riskBudget: "10% volatility target",
    capacityNote: "Signals use liquid futures, but financing, correlation shifts, and multi-account execution remain untested.",
    summary: "Medium-speed macro allocation with trend, carry, and defensive overlays across liquid futures.",
    process: ["Weekly signal rebalance", "Volatility-scaled exposure", "Correlation shock de-risking"],
    evidence: ["Read-only broker connection", "Daily balance reconciliation", "Model version log"],
    riskNotes: ["Rates reversal drove the deepest loss cluster", "Backtest is shown separately from live history"],
    equity: [100, 101, 104, 107, 105, 109, 112, 108, 111, 114, 116, 118],
  },
  {
    slug: "leila-haddad",
    displayName: "Leila Haddad",
    initials: "LH",
    location: "Dubai · UAE",
    strategy: "Defined-risk options",
    instruments: "SPX, QQQ options",
    proof: "Illustrative statement coverage",
    proofLevel: 4,
    returnPct: 25.1,
    sharpe: 1.71,
    maxDrawdownPct: 7.7,
    capitalBand: "$50K–$100K",
    trackRecord: "31 months",
    freshness: "Updated 6 days ago",
    riskBudget: "1.2% max defined loss",
    capacityNote: "Defined-loss structures are visible; fills and volatility skew can change materially with account size.",
    summary: "Event-aware options process using defined-loss structures and strict limits around macro releases.",
    process: ["No naked short options", "Event calendar checked pre-trade", "Closes risk before loss limits expand"],
    evidence: ["31 monthly statements", "Private tax-record attestation", "Payout history sampled"],
    riskNotes: ["Short-volatility exposure clusters in calm regimes", "Execution quality is sensitive to spread width"],
    equity: [100, 104, 103, 107, 110, 108, 112, 117, 114, 119, 122, 125],
  },
  {
    slug: "thomas-reed",
    displayName: "Thomas Reed",
    initials: "TR",
    location: "London · UK",
    strategy: "Relative value",
    instruments: "Equity index pairs",
    proof: "Illustrative reviewed record",
    proofLevel: 3,
    returnPct: 14.9,
    sharpe: 2.06,
    maxDrawdownPct: 4.8,
    capitalBand: "$1M–$2.5M",
    trackRecord: "44 months",
    freshness: "Updated 14 days ago",
    riskBudget: "Beta-neutral target",
    capacityNote: "The largest illustrative capital band here, but short availability and borrow cost still constrain scale.",
    summary: "Lower-volatility relative-value book with market-beta controls and explicit cost attribution.",
    process: ["Pairs selected by stable economic link", "Beta and factor drift checked daily", "Borrow costs included in review"],
    evidence: ["Admin-reviewed statements", "Position-level exposure sample", "Cost ledger reconciliation"],
    riskNotes: ["Crowding can break historical relationships", "Reported Sharpe is based on a limited live window"],
    equity: [100, 101, 102, 104, 103, 105, 107, 108, 107, 110, 113, 115],
  },
  {
    slug: "aisha-bello",
    displayName: "Aisha Bello",
    initials: "AB",
    location: "Toronto · Canada",
    strategy: "Commodities trend",
    instruments: "Energy, metals, grains",
    proof: "Illustrative imported history",
    proofLevel: 2,
    returnPct: 19.3,
    sharpe: 1.44,
    maxDrawdownPct: 10.2,
    capitalBand: "$100K–$250K",
    trackRecord: "22 months",
    freshness: "Updated 2 days ago",
    riskBudget: "8% volatility target",
    capacityNote: "Liquid contracts dominate, while roll cost and cross-market correlation are still key capacity limits.",
    summary: "Diversified trend process designed to distribute risk across commodity groups and time horizons.",
    process: ["Three signal speeds combined", "Sector risk capped", "Contracts rolled by liquidity rule"],
    evidence: ["Read-only futures history", "Daily NAV reconciliation", "Signal log sample"],
    riskNotes: ["Flat markets create repeated small losses", "Energy exposure produced the largest cluster"],
    equity: [100, 98, 102, 106, 105, 109, 107, 112, 116, 114, 117, 119],
  },
];

export function findExampleOperator(slug: string) {
  return EXAMPLE_OPERATORS.find((operator) => operator.slug === slug);
}
