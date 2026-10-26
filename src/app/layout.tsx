import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";
import { EVALUATION_PLANS, PROGRAMME_RULES } from "@/lib/prop-firm";
import { SITE_URL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Headlines, in the Manus style; body text uses the device's own UI font (globals.css). */
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
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
      className={`${libreBaskerville.variable} ${ibmPlexMono.variable} h-full antialiased`}
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
