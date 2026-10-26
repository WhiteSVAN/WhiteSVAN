import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { EVALUATION_PLANS, PROGRAMME_RULES } from "@/lib/prop-firm";
import { SITE_URL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/*
 * Type (docs/theme.md): Newsreader for headlines and big figures, Geist for text, Geist Mono for
 * prices. All three are variable and carry the rupee sign (₹), which is in the latin-ext subset,
 * so both subsets load. Newsreader's optical-size axis keeps big headlines fine and small ones sturdy.
 */
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
  display: "swap",
});

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WhiteSVAN | Get funded trading NIFTY, BANK NIFTY and SENSEX",
  description: `The prop firm for Indian index options. Pass one evaluation on a ${FIRST.label}–${LAST.label} account, get funded and keep ${PROGRAMME_RULES.contractorSharePercent}% of your profits.`,
  openGraph: { siteName: "WhiteSVAN", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The head script sets data-theme before the first paint, so React keeps the DOM's value.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
