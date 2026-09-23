/**
 * Parse the structured trader-identity fields shared by onboarding and
 * settings. Form input is untrusted: option keys are filtered to the known
 * vocabularies and free text is length-capped. Pure (takes FormData-like input).
 */
import { pickKey, pickKeys } from "@/lib/profile-options";

type FormLike = { get(name: string): unknown; getAll(name: string): unknown[] };

export interface TraderDetails {
  experienceYears: number | null;
  markets: string[];
  strategyTags: string[];
  region: string | null;
  capitalBand: string | null;
  credentials: string | null;
  registrationType: string | null;
  registrationNumber: string | null;
}

function text(form: FormLike, name: string, max: number): string | null {
  const value = String(form.get(name) ?? "").trim().slice(0, max);
  return value || null;
}

export function parseTraderDetails(form: FormLike): { data: TraderDetails; error?: string } {
  const yearsRaw = String(form.get("experienceYears") ?? "").trim();
  const years = yearsRaw === "" ? null : Number(yearsRaw);
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) {
    return { data: emptyDetails(), error: "Experience must be a whole number of years (0–60)." };
  }

  const registrationType = pickKey("registrationTypes", form.get("registrationType"));
  const registrationNumber =
    registrationType && registrationType !== "none" ? text(form, "registrationNumber", 40) : null;

  return {
    data: {
      experienceYears: years,
      markets: pickKeys("markets", form.getAll("markets")),
      strategyTags: pickKeys("strategyTags", form.getAll("strategyTags")),
      region: pickKey("regions", form.get("region")),
      capitalBand: pickKey("capitalBands", form.get("capitalBand")),
      credentials: text(form, "credentials", 200),
      registrationType,
      registrationNumber,
    },
  };
}

function emptyDetails(): TraderDetails {
  return {
    experienceYears: null,
    markets: [],
    strategyTags: [],
    region: null,
    capitalBand: null,
    credentials: null,
    registrationType: null,
    registrationNumber: null,
  };
}
