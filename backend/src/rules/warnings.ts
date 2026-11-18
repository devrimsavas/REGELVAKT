import { SOURCE_URLS } from "./obligations.js";
import type { WarningDefinition } from "./types.js";

export const WARNINGS: WarningDefinition[] = [
  {
    id: "vat-registration-required",
    appliesTo: (facts) =>
      !facts.vatRegistered && facts.expectsSalesOver50k === true,
    message: {
      nb: "Når salget av mva-pliktige varer og tjenester passerer 50 000 kroner i løpet av 12 måneder, skal foretaket registreres i Merverdiavgiftsregisteret.",
      en: "Once sales of goods and services subject to VAT pass NOK 50,000 within 12 months, the business must be registered in the VAT register.",
    },
    sourceUrl:
      "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/registrere/",
  },
  {
    id: "vat-term-unknown",
    appliesTo: (facts) => facts.vatRegistered && facts.vatTerm === "unknown",
    message: {
      nb: "Fristene for mva-meldingen avhenger av terminen. De fleste leverer annenhver måned; årstermin gjelder bare hvis du har søkt om det og fått det innvilget.",
      en: "The VAT return deadlines depend on the term. Most businesses file every two months; the annual term only applies if you applied for it and it was granted.",
    },
    sourceUrl: SOURCE_URLS.vatAnnualTerm,
  },
];
