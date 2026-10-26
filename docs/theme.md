# Themes: White and Dark

WhiteSVAN has two themes in the Manus style: **White** (warm paper, ink buttons) and **Dark**
(graphite, light ink buttons). Both use serif headlines and the WhiteSVAN green as the one accent.
A first visit follows the device's light or dark setting. Visitors can switch with the header toggle,
or pick System, White or Dark in the footer and the account menu. The choice is saved in the browser.

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

| Token | White | Dark | Paints |
| --- | --- | --- | --- |
| `--background` | `#f8f8f7` | `#141414` | Page |
| `--card` | `#ffffff` | `#1b1b1b` | Cards and panels |
| `--card-raised` | `#f1f1ef` | `#242424` | Hover, table headers, selected items |
| `--card-deep` | `#fafaf9` | `#111111` | Inset panels, the footer |
| `--input` | `#ffffff` | `#111111` | Form fields |
| `--foreground` | `#1a1a19` | `#ededeb` | Text |
| `--muted` | `#5e5e5b` | `#a3a3a0` | Secondary text |
| `--faint` | `#6f6e6b` | `#868683` | Placeholders, fine print |
| `--border` | `#e6e6e3` | `#2a2a2a` | Lines and card edges |
| `--border-strong` | `#d2d2cd` | `#3b3b3b` | Field edges, emphasis |
| `--ink` | `#1a1a19` | `#f2f2f0` | Main buttons, selected tabs |
| `--ink-hover` | `#3a3a37` | `#ffffff` | Main buttons on hover |
| `--ink-foreground` | `#ffffff` | `#141414` | Text on main buttons |
| `--primary` | `#2f7d32` | `#baf277` | The accent: links, gains, Buy, the logo |
| `--primary-hover` | `#276b2a` | `#cdf995` | The accent on hover |
| `--primary-foreground` | `#ffffff` | `#17200e` | Text on the accent (Buy buttons) |
| `--warning` | `#92650a` | `#e1c47e` | Warnings, test-mode notes |
| `--danger` | `#c4372f` | `#f2907e` | Losses, Sell, errors |
| `--danger-foreground` | `#ffffff` | `#2a0f0a` | Text on Sell buttons |
| `--chart-up` / `--chart-down` | `#2f9e44` / `#e03131` | `#baf277` / `#f2907e` | Candles and volume |
| `--chart-grid` | 6% ink | 5% white | Chart grid lines |
| `--chart-mark` | `#b07d12` | `#d8c899` | Average price and open interest on the chart |
| `--shadow-card` | soft | deep | Card shadows |

## Type

- Headlines: Libre Baskerville, regular weight. Every page title (`h1`) uses it, and so does anything
  with the `display` class (section titles, big figures).
- Text: the device's own interface font (San Francisco, Segoe UI and so on), as Manus does.
- Prices and tickers: IBM Plex Mono, so digits line up.

## Keeping both themes working

- Colour with tokens only: `bg-[var(--card)]`, `text-[var(--muted)]`, never a hex value in a
  component. A hex shows the same in both themes, and that is what breaks one of them.
- Main buttons are ink (`prop-button` or `bg-[var(--ink)]`). The green accent is for links, gains and
  buying, so a green button means Buy.
- Keep body text at a 4.5:1 contrast or better against its background in both themes.
- After a touch-up, look at the landing page, `/rules`, `/checkout/5l` and a trading screen in both
  themes. The footer's System, White and Dark buttons switch between them.
