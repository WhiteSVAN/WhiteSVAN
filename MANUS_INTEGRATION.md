# Manus proof-terminal integration

## Sources

- Visual reference: `https://trustproof-pqbppz7h.manus.space/`
- Source repository: `https://github.com/WhiteSVAN/trustsvan-proof-terminal`
- Source revision reviewed: `e0779f5`

The source repository is a standalone Vite demonstration backed by illustrative browser data. This
repository is the production Next.js application backed by Auth.js, Prisma, broker imports, published
profile snapshots, evidence privacy, and compliance checks. The integration therefore ports the design
and interactions into the existing application instead of combining two incompatible application roots.

## What was integrated

- Space Grotesk and IBM Plex Mono through `next/font`, with no runtime font request.
- The near-black, forest, and proof-lime token system from the Manus concept.
- The three-bar TrustSVAN terminal lockup, grid ambience, terminal panels, labels, dividers, focus
  states, responsive behavior, reduced-motion handling, and print rules.
- A responsive landing experience with an interactive performance / risk / evidence terminal.
- A real-data public directory with search, proof and strategy filters, sorting, local watchlists,
  two-record selection, and an accessible comparison dialog.
- Matching shells and controls across authentication, dashboard, network, onboarding, source import,
  reports, settings, public profiles, and diligence.
- Terminal-themed charts, calendar intensity, forms, upload controls, menus, status states, empty
  states, destructive actions, footers, and calls to action.

## What remains authoritative in the production app

- Existing authentication and authorization boundaries.
- Server actions, database schema, import adapters, code-computed metrics, immutable profile versions,
  evidence access rules, redaction, and report compliance checks.
- Public pages only read published snapshots. Tax records remain verification-only and private.
- Past-performance and non-advisory disclosures remain in place.

The Vite scaffold, Manus runtime, fixture data, and external links to the old Vercel app were deliberately
not copied because they would duplicate the application framework and bypass production data contracts.
