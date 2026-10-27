# Themes: White and Black

WhiteSVAN has two themes in the Manus style: **White** (paper white, ink buttons) and **Black**
(near-black, light ink buttons). Both use serif headlines and the WhiteSVAN green as the one accent.
A first visit follows the device's light or dark setting. Visitors can switch with the header toggle,
or pick System, White or Black in the footer and the account menu. The choice is saved in the browser.

## Where to change things

| What | Where |
| --- | --- |
| Every colour, for both themes | `src/app/globals.css`, the two blocks at the top |
| Headline and price fonts | `src/app/layout.tsx` (`next/font`) and `--font-*` in `globals.css` |
| What a first visit shows | `DEFAULT_THEME` in `src/lib/theme.ts`: `"system"`, `"light"` or `"dark"` |
| Shared buttons, cards and labels | `.prop-button`, `.prop-button-outline`, `.terminal-card`, `.terminal-label`, `.display` in `globals.css` |

Change a token and every page, the trading chart and the Razorpay payment window follow it.
Keep the token names, so the screens that use them don't need to change.

## Colour tokens

| Token | White | Black | Paints |
| --- | --- | --- | --- |
| `--background` | `#f7f7f5` | `#0a0a0b` | Page |
| `--card` | `#ffffff` | `#121214` | Cards and panels |
| `--card-raised` | `#f0efec` | `#1a1a1d` | Hover, table headers, selected items |
| `--card-deep` | `#fbfbfa` | `#070708` | Inset panels, the footer |
| `--input` | `#ffffff` | `#0d0d0f` | Form fields |
| `--foreground` | `#131312` | `#f1f0ec` | Text |
| `--muted` | `#57564f` | `#a3a29d` | Secondary text |
| `--faint` | `#6b6a64` | `#86857f` | Placeholders, fine print |
| `--border` | `#e6e5e1` | `#232326` | Lines and card edges |
| `--border-strong` | `#d3d2cc` | `#36363b` | Field edges, emphasis |
| `--ink` | `#131312` | `#f4f3ef` | Main buttons, selected tabs |
| `--ink-hover` | `#2e2e2b` | `#ffffff` | Main buttons on hover |
| `--ink-foreground` | `#ffffff` | `#0a0a0b` | Text on main buttons |
| `--primary` | `#1f6f3b` | `#baf277` | The accent: links, gains, Buy, the logo |
| `--primary-hover` | `#185c30` | `#cdf995` | The accent on hover |
| `--primary-foreground` | `#ffffff` | `#17200e` | Text on the accent (Buy buttons) |
| `--warning` | `#8a5d06` | `#e1c47e` | Warnings, test-mode notes |
| `--danger` | `#b8322a` | `#f2907e` | Losses, Sell, errors |
| `--danger-foreground` | `#ffffff` | `#2a0f0a` | Text on Sell buttons |
| `--chart-up` / `--chart-down` | `#23894a` / `#d63a30` | `#baf277` / `#f2907e` | Candles and volume |
| `--chart-grid` | 6% ink | 5% white | Chart grid lines |
| `--chart-mark` | `#b07d12` | `#d8c899` | Average price and open interest on the chart |
| `--chart-gain` / `--chart-loss` | `#34a35a` / `#ae2f29` | `#5aa95b` / `#b5413b` | Daily P&L bars in the admin portal; validated apart for colour-blind readers |
| `--chart-line` | `#1f6f3b` | `#73a63a` | Balance lines in the admin portal |
| `--shadow-card` | soft | deep | Card shadows |

## Type
All three fonts load through `next/font` in `src/app/layout.tsx`, with the `latin-ext` subset, which
carries the rupee sign (₹): without it, every ₹ falls back to another font.
- Headlines and big figures: Newsreader, regular weight, with its optical-size axis. Every page title
  (`h1`) uses it, and so does anything with the `display` class (section titles, account sizes).
- Text: Geist. Small uppercase eyebrows use `.terminal-label`.
- Prices and tickers: Geist Mono (`font-mono`), with tabular digits so columns line up. For a price
  in the text font, add `tabular-figures`.

## Keeping both themes working

- Colour with tokens only: `bg-[var(--card)]`, `text-[var(--muted)]`, never a hex value in a
  component. A hex shows the same in both themes, and that is what breaks one of them.
- Main buttons are ink (`prop-button` or `bg-[var(--ink)]`). The green accent is for links, gains and
  buying, so a green button means Buy.
- Keep body text at a 4.5:1 contrast or better against its background in both themes.
- After a touch-up, look at the landing page, `/rules`, `/checkout/5l` and a trading screen in both
  themes. The footer's System, White and Black buttons switch between them.
