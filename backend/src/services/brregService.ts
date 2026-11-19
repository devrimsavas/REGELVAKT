import { toCompany } from "../mappers/companyMapper.js";
import type { BrregEnhet } from "../types/brreg.js";
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

// ---- Cache ----

// One user's assessment looks the same company up three times within a few
// minutes (company, questions, assessment). Active companies are kept for a
// short while so Brreg is asked once. Struck-off and unknown companies are
// not kept: a company registered a minute ago must be found at once.
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;

const cache = new Map<string, { expires: number; company: Company }>();

function cached(orgNumber: string, now: number): Company | null {
  const entry = cache.get(orgNumber);
  if (!entry) return null;
  if (entry.expires <= now) {
    cache.delete(orgNumber);
    return null;
  }
  return entry.company;
}

function remember(orgNumber: string, company: Company, now: number): void {
  // A Map keeps the order entries were added, so the first is the oldest
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(orgNumber)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.delete(orgNumber);
  cache.set(orgNumber, { expires: now + CACHE_MS, company });
}

// For tests: start every test with an empty cache
export function clearBrregCache(): void {
  cache.clear();
}

// ---- Checking the answer ----

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// The fields everything else depends on. An answer without them is not
// stored, so a change in Brreg's API can never fill the database with
// broken companies; the caller gets a BrregError instead.
function assertEnhet(data: unknown, orgNumber: string): BrregEnhet {
  if (
    !isObject(data) ||
    data.organisasjonsnummer !== orgNumber ||
    !isNonEmptyString(data.navn) ||
    !isObject(data.organisasjonsform) ||
    !isNonEmptyString(data.organisasjonsform.kode)
  ) {
    throw new BrregError(
      `Brreg API gave an unexpected answer for ${orgNumber}`,
    );
  }
  return data as unknown as BrregEnhet;
}

// ---- Looking up ----

// Looks up a company and tells whether it is active, struck off or unknown.
// fresh skips the cache, for when the data must come from Brreg now, such
// as the weekly refresh of stored companies.
export async function lookupCompany(
  orgNumber: string,
  options: { fresh?: boolean } = {},
): Promise<CompanyLookup> {
  const now = Date.now();
  if (!options.fresh) {
    const company = cached(orgNumber, now);
    if (company) return { status: "active", company };
  }

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

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BrregError(`Brreg API gave an answer that is not JSON`);
  }

  if (isObject(data) && data.respons_klasse === "SlettetEnhet") {
    return {
      status: "deleted",
      deletedDate: isNonEmptyString(data.slettedato) ? data.slettedato : null,
    };
  }

  const company = toCompany(assertEnhet(data, orgNumber));
  remember(orgNumber, company, now);
  return { status: "active", company };
}
