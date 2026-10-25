# Investor demo build, 25 Oct 2026 (Claude)

Founder's direction: clean up the wording; there are no appeals; keep building the order management
system and the Razorpay integration, for demos to potential investors. Real payout APIs come later.

## Wording

- Appeals are gone everywhere: the rules (the last section is now **Fees**, `#fees`: one fee, no
  subscription, activation fee or deposit), the help center, the evaluations FAQ and the Academy. A
  breached account shows the rule, the date and the equity at the time, as the platform already does.
- One way of describing the programme: you buy an **evaluation**, trade it in a **demo account**,
  and passing opens a **funded account**. "Demo (evaluation)" asides and "eligible profit" are gone:
  payouts are "whenever your profit is above the buffer, up to the cap".
- How it works: the funded-account step lists what a funded account is (opens when you pass, same
  limits, no target, 80% split); KYC sits under Get paid, before the first payout.

## Order management: stop-loss and target

- A buy can carry a stop-loss (trigger) and a target. Once the buy fills, the desk places an SL-M
  sell at the stop and a limit sell at the target, for the filled lots.
- One cancels the other: when the stop-loss fills, the target is cancelled ("Stop-loss hit"), and
  the other way round ("Target hit"). Closing the position some other way (Exit, Exit all, a sell)
  cancels both ("Position closed"); selling part of it trims both to what's left. The 15:20
  square-off and a breach cancel them with everything else.
- A stop-loss the market has already passed when the buy fills isn't placed; the activity log says
  so and the target still works.
- The ticket checks both prices before sending (stop-loss below the expected fill, target above it,
  on the tick), and the server checks them again (`exitsProblem`).
- It all runs in the desk host (`deskStep` → `followBrackets`), so the engine stays a pure
  single-order state machine and every path that changes an account keeps the exits in line.
- The Orders tab tags the exits ("SL-M · Stop-loss", "LIMIT · Target"); Positions shows each open
  position's stop-loss and target.
- The option chart draws the position's average price, the stop-loss, the target and any working
  order as dashed price lines (`chartLines`), and fills, exits and stops pop up as alerts for a few
  seconds.

## Razorpay for demos

- With test keys (`rzp_test_…`), checkout says it's Razorpay test mode and gives the test UPI ID
  (`success@razorpay`) and card (`4100 2800 0000 1007`, any future expiry, any CVV, a 4-digit OTP).
- Test orders are recorded as provider `razorpay-test`. The confirmation reads "Razorpay test mode ·
  pay_…" and "₹2,999 · test mode, not charged", and the receipt email says no money was charged.
- Setting it up: create a Razorpay account, generate **test** API keys (Dashboard → Account &
  Settings → API Keys), add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Vercel (Production), and
  redeploy. Optional: a webhook for `payment.captured` and `order.paid` with
  `RAZORPAY_WEBHOOK_SECRET`.
- Payouts stay a display: figures from the rules on the Payouts page, no requests or payout API.

## Checks

- 498 tests pass, including the PostgreSQL suites against a disposable local database; 10 new desk
  tests cover the stop-loss and target (placement, one-cancels-other both ways, closing by hand,
  trimming, a limit buy that fills later, a cancelled buy, a stop the market has passed, the
  square-off, a JSON round trip, chart lines and the price checks).
- Type-check, lint and the production build pass.
- End to end against the Kite and Razorpay stand-ins (synthetic prices, an intercepted Checkout.js):
  - free mode, 37/37: no appeals, launch or demo-credit copy on public pages; a free start; the
    chart-first screen; a buy with a stop-loss and target (refused when the stop is above the
    price, then working, tagged in Orders, shown in Positions, drawn on the chart, alerted, and both
    cancelled with "Position closed" on Exit); a pass opening a funded account; payout figures;
    375px phones;
  - Razorpay test mode, 18/18: the test details at checkout, a pending order, closing and a failed
    payment, a paid order recorded as `razorpay-test` with "test mode, not charged" on the
    confirmation and the receipt, a forged signature, an authorised payment waiting for capture,
    and signed, repeated webhooks opening one account.
- No real Razorpay keys or payments were used.
