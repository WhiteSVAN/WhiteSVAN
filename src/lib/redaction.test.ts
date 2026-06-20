import { describe, expect, it } from "vitest";
import { redactReport, redactText } from "./redaction";

describe("redaction", () => {
  it("masks currency amounts and private labels", () => {
    expect(
      redactText("Demo Futures made $25,000 at Broker One, then lost -$1,250.50.", {
        hideAmounts: true,
        terms: ["Demo Futures", "Broker One"],
      }),
    ).toBe("Private label made Private amount at Private label, then lost Private amount.");
  });

  it("redacts every report field", () => {
    const report = redactReport(
      {
        executive_summary: "Demo Futures ended at $10,000.",
        performance_summary: "Broker One data was reviewed.",
        risk_summary: "",
        discipline_review: "",
        notable_days: ["Best day was $500."],
        warnings: ["Broker One losses were larger."],
        client_disclaimer: "Past performance does not guarantee future results.",
      },
      { hideAmounts: true, terms: ["Demo Futures", "Broker One"] },
    );

    expect(JSON.stringify(report)).not.toContain("$");
    expect(JSON.stringify(report)).not.toContain("Demo Futures");
    expect(JSON.stringify(report)).not.toContain("Broker One");
  });
});
