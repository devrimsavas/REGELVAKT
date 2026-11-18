import type { BrregEnhet } from "../types/brreg.js";
import type { Company } from "../types/company.js";

// Converts a raw Brreg entity into the app's own Company shape.
export function toCompany(enhet: BrregEnhet): Company {
  const address = enhet.forretningsadresse;

  return {
    orgNumber: enhet.organisasjonsnummer,
    name: enhet.navn,
    organizationForm: enhet.organisasjonsform.kode,
    organizationFormDescription: enhet.organisasjonsform.beskrivelse,

    address: address
      ? {
          postalCode: address.postnummer ?? null,
          city: address.poststed ?? null,
          municipality: address.kommune ?? null,
          municipalityNumber: address.kommunenummer ?? null,
        }
      : null,

    industryCode: enhet.naeringskode1?.kode ?? null,
    industryDescription: enhet.naeringskode1?.beskrivelse ?? null,

    employees: enhet.antallAnsatte ?? null,
    hasRegisteredEmployees: enhet.harRegistrertAntallAnsatte ?? false,

    foundedDate: enhet.stiftelsesdato ?? null,
    registrationDate: enhet.registreringsdatoEnhetsregisteret ?? null,

    vatRegistered: enhet.registrertIMvaregisteret ?? false,
    businessRegisterRegistered: enhet.registrertIForetaksregisteret ?? false,

    isBankrupt: enhet.konkurs ?? false,
    isUnderLiquidation: enhet.underAvvikling ?? false,
    isUnderForcedLiquidation:
      enhet.underTvangsavviklingEllerTvangsopplosning ?? false,
  };
}
