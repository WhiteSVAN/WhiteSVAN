import type { Metadata } from "next";
import { PropLanding } from "@/components/prop-firm/landing";

export const metadata: Metadata = {
  title: "WhiteSVAN — Your skill. A bigger stage.",
  description: "Explore WhiteSVAN's India-first prop trading programme. Compare simulated evaluation accounts, understand the rules, and build your edge with SVAN Academy.",
};

export default function Home() {
  return <PropLanding />;
}
