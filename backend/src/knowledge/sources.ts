// Which pages the assistant's knowledge base is built from. Only official
// sites are read, and only the sections that are about the obligations
// Regelvakt covers.
import { OBLIGATIONS } from "../rules/obligations.js";

export interface Seed {
  url: string;
  // Also read the pages this one links to in the same section: links whose
  // path starts with the seed's parent path
  followLinks: boolean;
}

// The hosts the crawler may read. skatt.skatteetaten.no is left out: it is
// the logged-in service, not information.
export const ALLOWED_HOSTS = new Set([
  "www.skatteetaten.no",
  "www.brreg.no",
  "lovdata.no",
  "info.altinn.no",
]);

// Pages on these hosts are read alone: a law or a form page links to far
// more than the knowledge base needs
const READ_ALONE = new Set(["lovdata.no", "info.altinn.no"]);

// Pages beyond the obligations' own sources, checked on 19 November 2026
const EXTRA_PAGES = [
  "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-naringsdrivende/",
  "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/betale-mva/sma-virksomheter-kan-soke-om-a-rapportere-mva-en-gang-i-aret/",
];

// At most this many linked pages are read per seed, and this many in all
export const MAX_LINKED_PAGES_PER_SEED = 12;
export const MAX_PAGES = 150;

export function seeds(): Seed[] {
  const urls = new Set<string>([
    ...OBLIGATIONS.map((obligation) => obligation.sourceUrl),
    ...EXTRA_PAGES,
  ]);
  return [...urls].map((url) => ({
    url,
    followLinks: !READ_ALONE.has(new URL(url).host),
  }));
}

// A link the crawler may follow from the seed: same host, an allowed host,
// within the seed's section, and a page rather than a file
export function isInSection(link: URL, seed: URL): boolean {
  if (link.host !== seed.host || !ALLOWED_HOSTS.has(link.host)) return false;
  const section = seed.pathname.replace(/[^/]*\/?$/, "");
  if (!link.pathname.startsWith(section)) return false;
  return !/\.(pdf|docx?|xlsx?|zip|png|jpe?g|gif|svg)$/i.test(link.pathname);
}

// The same page is the same URL without its fragment and query
export function normalizeUrl(url: URL): string {
  const copy = new URL(url.href);
  copy.hash = "";
  copy.search = "";
  return copy.href;
}
