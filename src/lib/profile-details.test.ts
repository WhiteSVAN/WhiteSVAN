import { describe, expect, it } from "vitest";
import { parseTraderDetails } from "./profile-details";

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseTraderDetails", () => {
  it("keeps only known option keys", () => {
    const { data } = parseTraderDetails(
      form([["markets", "in_fno"], ["markets", "moon"], ["region", "IN"], ["strategyTags", "swing"]]),
    );
    expect(data.markets).toEqual(["in_fno"]);
    expect(data.region).toBe("IN");
    expect(data.strategyTags).toEqual(["swing"]);
  });

  it("drops the registration number when not registered", () => {
    const { data } = parseTraderDetails(form([["registrationType", "none"], ["registrationNumber", "INH000"]]));
    expect(data.registrationNumber).toBeNull();
  });

  it("keeps a SEBI registration number", () => {
    const { data } = parseTraderDetails(form([["registrationType", "sebi_ra"], ["registrationNumber", " INH000012345 "]]));
    expect(data).toMatchObject({ registrationType: "sebi_ra", registrationNumber: "INH000012345" });
  });

  it("rejects impossible experience", () => {
    expect(parseTraderDetails(form([["experienceYears", "-2"]])).error).toBeDefined();
    expect(parseTraderDetails(form([["experienceYears", "2.5"]])).error).toBeDefined();
    expect(parseTraderDetails(form([["experienceYears", ""]])).data.experienceYears).toBeNull();
  });
});
