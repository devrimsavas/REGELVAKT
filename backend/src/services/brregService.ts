import { toCompany } from "../mappers/companyMapper.js";
import type { BrregEnhet, BrregEnhetResponse } from "../types/brreg.js";
import type { Company } from "../types/company.js";

const BRREG_BASE_URL = "https://data.brreg.no/enhetsregisteret/api";
const REQUEST_TIMEOUT_MS = 10_000;

// Result of looking up one company in the register.
export type CompanyLookup =
  | { status: "active"; company: Company }
  // Struck off the register. deletedDate is null when Brreg does not give one.
  | { status: "deleted"; deletedDate: string | null }
  | { status: "notFound" };

export class BrregError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrregError";
  }
}

// Looks up a company and tells whether it is active, struck off or unknown.
export async function lookupCompany(orgNumber: string): Promise<CompanyLookup> {
  let response: Response;

  try {
    response = await fetch(`${BRREG_BASE_URL}/enheter/${orgNumber}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BrregError(`Could not reach the Brreg API: ${message}`);
  }

  if (response.status === 404) {
    return { status: "notFound" };
  }

  // 410 Gone: removed from Brreg's open data
  if (response.status === 410) {
    return { status: "deleted", deletedDate: null };
  }

  if (!response.ok) {
    throw new BrregError(
      `Brreg API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as BrregEnhetResponse;

  if (data.respons_klasse === "SlettetEnhet") {
    return {
      status: "deleted",
      deletedDate: "slettedato" in data ? (data.slettedato ?? null) : null,
    };
  }

  return { status: "active", company: toCompany(data as BrregEnhet) };
}
