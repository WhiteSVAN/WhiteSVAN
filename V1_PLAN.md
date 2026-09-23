# TrustSVAN V1 Plan — verifiable trader records → network

> Working plan for the V1 build. Source of truth for tech remains [CLAUDE.md](CLAUDE.md) and the code.
> Design stays as-is (dark terminal system); work here is functionality-first.

## 1. Reference points

### PeakBot (peakbot.com) — the eventual direction
- **What it is:** an options copy-trading marketplace ("Bot Shop"). Subscribers pick a trader/algo,
  set a budget per ticker, and trades are mirrored into their own brokerage account within seconds.
  Traders earn recurring subscription revenue; PeakBot handles billing and distribution.
- **What it lacks:** no visible verification method. "Traders trust PeakBot" + broker logos, but no
  published drawdowns, coverage, source provenance, or record length. Discovery is a storefront.
- **What we take from it:** a marketplace needs (1) a trusted supply of traders, (2) a way for
  demand to find and follow them, and (3) monetization rails. We build (1) and (2) now, on evidence
  rather than marketing. (3) — subscriptions and automated execution — is a later, regulated phase.

### Flameback Capital (flamebackcapital.com/about/team) — how Indian systematic managers present
- SEBI-registered investment adviser (registration no. and BSE enlistment shown on every page),
  distributing systematic portfolios via smallcase.
- Team page shows **name, title, years of experience, credentials (e.g. CFA), a 2–3 line bio**,
  split into core team and advisors. It shows **no track record** — only credentials — plus strong
  "registration does not guarantee performance" disclaimers.
- **What we take from it:** Indian clients expect *registration* and *credentials* up front. We add
  experience, credentials and regulatory registration (SEBI RA / IA, etc.) as structured, clearly
  **self-declared** profile fields — and pair them with the thing Flameback's page cannot show:
  a source-linked performance record.

### Positioning that falls out of this
PeakBot = marketplace without proof. Flameback = credentials without a public record.
TrustSVAN V1 = **record + credentials + context**, which is the trust layer a PeakBot-style India
marketplace would need before it can responsibly exist.

## 2. Guardrails (unchanged for V1)
No execution, copy-trading, signals, allocation advice, return predictions, or performance fees.
Posts are research/discussion, never "enter now" calls. Inquiries open a *conversation*, not a
mandate. Every public surface keeps the past-performance disclaimer. The banned-language filter
covers posts, comments, inquiries, and community copy.

## 3. V1 build order

| # | Phase | Scope | Status |
|---|-------|-------|--------|
| 1 | Data & verification integrity | Correct publishing, freshness semantics, duplicate-import guard, factual provenance instead of scores, secure evidence, demo/real separation | ✅ shipped (38c26f8) |
| 2 | Trader & client accounts | Role at signup (Trader / Client), role-aware onboarding + nav + dashboards, Google sign-in (env-gated) | this pass |
| 3 | Functional proof profiles | Experience, markets, strategy tags, region, capital band, credentials, registration; tabs (Overview · Performance · Proof history · Posts); provenance line beside metrics; coverage-gap detection; section-level privacy | this pass |
| 4 | Discovery | Single `/explore`; structured filters (market, strategy, region, capital band, source, availability, record length); default sort = recently updated; server-backed follow + private watchlist; no return/score ranking | this pass |
| 5 | Social | Structured posts (Market View, Trade Thesis, Trade Review, Research, Performance Update, Educational) with author record context; verified-position badge only when an imported execution matches; comments + likes | this pass |
| 6 | Professional inquiries | Availability settings; client → trader conversation requests; accept / decline / ignore; messaging unlocks on accept; in-app notifications | this pass |
| 7 | Communities | Create, public/private, invite links, join/approve, roster with factual record info, admin remove/notes/rules, flags, community-scoped posts | this pass |
| 8 | Growth | OG metadata + share card image, trader referral links, profile-view + inquiry-conversion analytics | this pass |
| 9 | India readiness | INR account currency, NSE/BSE/MCX markets, SEBI registration fields surfaced, legal review (below) | fields this pass; rest next |

Retained as-is: CSV parsing + FIFO, metric engine, trading accounts + daily P&L, immutable
snapshots, public profiles, evidence storage, import history, charts, auth foundation. AI briefs and
tax-return uploads stay available but move out of the primary journey.

## 4. Data model additions (one migration)
- `User.role` (`TRADER` | `CLIENT`, nullable until chosen), `User.referralCode`, `User.referredById`.
- `ClientProfile` — organization, client type, markets/regions/strategies of interest.
- `TraderProfile` — `experienceYears`, `markets[]`, `strategyTags[]`, `region`, `capitalBand`,
  `credentials`, `registrationType`, `registrationNumber`, `acceptInquiries`, `hiddenSections[]`.
- `Follow`, `WatchlistItem` (private), `ProfileView`.
- `Post`, `PostComment`, `PostLike`, `PostFlag` (post may be community-scoped).
- `Inquiry`, `InquiryMessage`, `AppNotification`.
- `Community`, `CommunityMember`, `CommunityInvite`.
- `TradingAccount.currency` (default `USD`).

## 5. India launch — open items before going live
1. **Regulatory review with Indian counsel.** SEBI restricts unregistered persons from giving paid
   advice/recommendations and restricts regulated entities (brokers, advisers) from associating
   with unregistered people who make return/performance claims. A platform publishing retail
   traders' returns in India — especially one partnering with brokers — needs a legal opinion on
   how records are displayed (e.g. registration-gated, lagged, or education-only framing).
2. **Anything PeakBot-like** (subscriptions to a trader, automated order routing) in India runs
   through SEBI's retail algo framework (broker-routed, exchange-registered algos) and RA/IA
   registration for paid research. Treat as a separate, licensed product track.
3. **Broker connectors:** Zerodha Kite Connect, Upstox, Dhan, Angel One tradebook exports first
   (CSV bridge), then read-only APIs.
4. **Data residency / DPDP Act** compliance for Indian users' personal data.
