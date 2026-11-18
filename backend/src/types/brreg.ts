// Shapes of the data returned by the Brønnøysund Register Centre API.
// Only the fields this app uses are listed; the API returns more.

export interface BrregKode {
  kode: string;
  beskrivelse: string;
}

export interface BrregAdresse {
  adresse?: string[];
  postnummer?: string;
  poststed?: string;
  kommune?: string;
  kommunenummer?: string;
}

export interface BrregEnhet {
  // Identity
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform: BrregKode;

  // Location
  forretningsadresse?: BrregAdresse;

  // Industry
  naeringskode1?: BrregKode;

  // Employees. Brreg leaves antallAnsatte out for many small companies,
  // so a missing value does not mean zero employees.
  antallAnsatte?: number;
  harRegistrertAntallAnsatte?: boolean;

  // Dates
  stiftelsesdato?: string;
  registreringsdatoEnhetsregisteret?: string;

  // Registers the company is entered in
  registrertIMvaregisteret?: boolean;
  registrertIForetaksregisteret?: boolean;

  // Status flags
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
}

// A company that has been struck off the register.
// Brreg answers with 200 OK but only a few fields.
export interface BrregSlettetEnhet {
  organisasjonsnummer: string;
  navn: string;
  respons_klasse: "SlettetEnhet";
  slettedato?: string;
}

// Response of GET /enheter/{orgNumber}: an active or a struck-off company.
export type BrregEnhetResponse =
  | (BrregEnhet & { respons_klasse?: string })
  | BrregSlettetEnhet;
