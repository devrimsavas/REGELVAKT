import { SOURCE_URLS } from "./obligations.js";
import type { WarningDefinition } from "./types.js";

// The company's own entry in the Central Coordinating Register, where the
// winding-up status and its details are shown
const REGISTER_LOOKUP =
  "https://data.brreg.no/enhetsregisteret/oppslag/enheter";

export const WARNINGS: WarningDefinition[] = [
  {
    id: "company-bankrupt",
    appliesTo: (facts) => facts.windingUp === "bankrupt",
    message: {
      nb: "Enhetsregisteret viser at virksomheten er konkurs. Da er det bostyreren som har ansvaret for de fleste pliktene overfor Skatteetaten og Brønnøysundregistrene, og fristene under gjelder kanskje ikke lenger for deg. Snakk med bostyreren.",
      en: "The Central Coordinating Register shows that the business is bankrupt. The trustee in bankruptcy is then responsible for most obligations to the Tax Administration and the Brønnøysund Register Centre, and the deadlines below may no longer apply to you. Talk to the trustee.",
    },
    sourceUrl: REGISTER_LOOKUP,
  },
  {
    id: "company-forced-liquidation",
    appliesTo: (facts) => facts.windingUp === "forcedLiquidation",
    message: {
      nb: "Enhetsregisteret viser at virksomheten er under tvangsavvikling eller tvangsoppløsning. Det skjer blant annet når årsregnskap ikke er sendt inn, eller når selskapet mangler styre eller revisor. Finn ut hva som mangler så snart som mulig; pliktene under gjelder fortsatt.",
      en: "The Central Coordinating Register shows that the business is under forced liquidation or dissolution. This happens for example when annual accounts have not been submitted, or the company has no board or auditor. Find out what is missing as soon as possible; the obligations below still apply.",
    },
    sourceUrl: REGISTER_LOOKUP,
  },
  {
    id: "company-under-liquidation",
    appliesTo: (facts) => facts.windingUp === "liquidation",
    message: {
      nb: "Enhetsregisteret viser at virksomheten er under avvikling. Pliktene under gjelder til virksomheten er slettet, og det siste året skal også rapporteres, blant annet i skattemeldingen.",
      en: "The Central Coordinating Register shows that the business is being wound up. The obligations below apply until it is deleted, and the last year must be reported too, for example in the tax return.",
    },
    sourceUrl: REGISTER_LOOKUP,
  },
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
