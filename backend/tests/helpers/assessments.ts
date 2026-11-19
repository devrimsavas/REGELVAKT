import { toCompany } from "../../src/mappers/companyMapper.js";
import { Assessment } from "../../src/models/Assessment.js";
import { RULES_VERSION } from "../../src/rules/version.js";
import type { BrregEnhet } from "../../src/types/brreg.js";

export const ORG_NUMBER = "974760673";

// A fictional sole proprietorship with the same structure as a Brreg response
export const enkEnhet: BrregEnhet = {
  organisasjonsnummer: ORG_NUMBER,
  navn: "AYSE FRISØR",
  organisasjonsform: { kode: "ENK", beskrivelse: "Enkeltpersonforetak" },
  forretningsadresse: {
    adresse: ["Bragernes Torg 1"],
    postnummer: "3017",
    poststed: "DRAMMEN",
    kommune: "DRAMMEN",
    kommunenummer: "3301",
  },
  naeringskode1: { kode: "96.021", beskrivelse: "Frisering" },
  harRegistrertAntallAnsatte: false,
  stiftelsesdato: "2026-03-01",
  registreringsdatoEnhetsregisteret: "2026-03-04",
  registrertIMvaregisteret: true,
  registrertIForetaksregisteret: false,
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
};

// A stored assessment for the company above, made without calling Brreg
export function createAssessment(): Promise<Assessment> {
  return Assessment.create({
    orgNumber: ORG_NUMBER,
    companySnapshot: toCompany(enkEnhet),
    answers: { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true },
    rulesVersion: RULES_VERSION,
  });
}
