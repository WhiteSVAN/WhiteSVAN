# India Academy UX review and first implementation

Reviewed on 16 October 2026. Base source: `origin/main` at `687a775`.
Working branch: `codex/india-education-ux`.

## Review basis

The live `https://white-svan.vercel.app/` returned HTTP 200. Its rendered HTML
matches the green Proof Terminal experience: Space Grotesk, IBM Plex Mono,
forest surfaces, lime accents, explicit illustrative-record labels and factual
source/coverage language. The initial local checkout was behind the deployment;
this work started from a new branch of the fetched current main.

No browser surface was available in the session. This review covers served
markup and source, not a screenshot inspection or an authenticated user session.

## Findings carried forward

| Finding | Result in this slice |
| --- | --- |
| The new education/evaluation direction has no entry point in the current record app. | Add Academy links to public navigation, footer and both workspace roles. |
| The existing design already has a coherent terminal system. | Reuse the current tokens, typography, cards, focus states and responsive patterns. |
| Main navigation is hidden below desktop width. | Add a horizontally scrollable public mobile navigation row. |
| Workspace links lack current-page context, and a dropdown inside the scrolling nav risks clipping. | Add active link indication; keep the account menu outside the scrolling link container. |
| Education, simulation, selection and live access can be confused. | Give each stage an explicit description and distinguish sample exercises from the future paid assessment. |
| The two paid offerings are confirmed, but prices and final terms are not. | Describe education and evaluation separately; no prices, checkout, enrolment or recurring-payment assumptions. |

The latest base already supports INR account presentation, factual uploaded-evidence
labels, account-scoped publication, conservative overlap rejection and persisted
communities. This slice preserves those behaviours rather than rebuilding them.

## Implemented

- [x] Public `/academy` route with shareable Learn, Evaluation Preview and
  Consultant Pathway sections. Unknown section values fall back to Learn.
- [x] Four sample lessons covering contract identification, costs and contract
  notes, journal coverage, and the limits of simulated assessment.
- [x] Lesson navigation, radio-button self-checks, explanations, keyboard focus
  handling and explicitly visit-only practice progress.
- [x] A synthetic five-session rule exercise with selectable examples and
  adjustable INR daily closed-loss and end-of-day drawdown thresholds.
- [x] Exact-paise threshold validation, integer-paise calculations, equality
  boundaries, cumulative drawdown and recovery examples.
- [x] Plain-language distinctions between simulated results, consultant
  selection, a separate services agreement and authorised firm-capital access.
- [x] Public/workspace navigation and footer entry points without journal,
  profile, import, authentication or database changes.

## Still planned

- [ ] Research sessions and comprehension tests with representative learners,
  candidates, reviewers and finance/support users.
- [ ] Professional review of the paid education/evaluation model, data rights,
  incentives, consumer terms, consultant work and company trading access.
- [ ] Final curriculum, pricing, duration, prerequisites, refund policy and any
  renewal/retake/reset/activation terms.
- [ ] Persistent learning records, genuine evaluation attempts, rule acceptance,
  scoring evidence, appeals and billing-dispute case tracking.
- [ ] India broker adapters, versioned derivative contract identity and
  intraday data coverage for any assessment that needs them.
- [ ] Consultant applications, agreements, finance onboarding and separately
  approved firm-capital operations.
- [ ] Desktop/mobile browser, keyboard and authenticated-data verification.

The public preview accepts no payment, application or trading instruction. It
reads no private trading data. The exercise uses fictional closed-P&L rows and
cannot establish intraday equity, open-position, margin or order-control breaches.

## Validation

- TypeScript and ESLint pass.
- Unit tests: 233 passed; 3 existing database-dependent tests skipped. Eight
  tests cover the new exercise calculations and input boundaries.
- Next.js production build passes using `next build` directly. The repository's
  migration-running `npm run build` script was not used.
- Production HTTP smoke checks return 200 and expected rendered content for
  `/`, `/academy`, both other Academy sections and an unknown-section fallback.
- An unauthenticated `/dashboard` request still redirects to `/login`.
- `git diff --check` passes.

Changes are local and have not been deployed. The related Notion sprint plan
tracks the remaining business and professional-review work:
https://app.notion.com/p/3fa7e713c0d28183ab7cc1826d90646d
