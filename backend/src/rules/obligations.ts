// The obligations Regelvakt knows about, for ENK and AS.
// Deadlines and rules verified against Skatteetaten and Brønnøysundregistrene
// in November 2026 (see RULES_VERSION).
import type { DeadlineSchedule, ObligationDefinition } from "./types.js";

const URLS = {
  vatReturn:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/mva-melding/",
  vatAnnualTerm:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/betale-mva/sma-virksomheter-kan-soke-om-a-rapportere-mva-en-gang-i-aret/",
  taxReturnEnk:
    "https://www.skatteetaten.no/nn/bedrift-og-organisasjon/skatt-for-bedrift-og-organisasjon/skattemelding-for-naringsdrivande/skattemelding-for-enkeltpersonforetak/",
  taxReturnCompany:
    "https://www.skatteetaten.no/nn/bedrift-og-organisasjon/skatt-for-bedrift-og-organisasjon/skattemelding-for-naringsdrivande/",
  advanceTaxEnk:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/forskuddsskatt/forskuddsskatt-for-enkeltpersonforetak/",
  advanceTaxAs:
    "https://www.skatteetaten.no/nn/bedrift-og-organisasjon/skatt-for-bedrift-og-organisasjon/forskuddsskatt/forskotsskatt-for-aksjeselskap-as-og-andre/",
  aMelding:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/arbeidsgiver/a-meldingen/hjelp/hvem-ma-levere-a-melding/",
  employerContribution:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/arbeidsgiver/arbeidsgiveravgift/betaling-av-forskuddstrekk-og-arbeidsgiveravgift/",
  shareholderRegister:
    "https://www.skatteetaten.no/skjema/rf-1086-aksjonarregisteroppgaven/",
  annualAccounts: "https://www.brreg.no/bedrift/arsregnskap/",
  generalMeeting: "https://lovdata.no/lov/1997-06-13-44/§5-5",
  bookkeeping:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/ny-som-naringsdrivende/oppstart/",
} as const;

// VAT terms of two months: due one month and ten days after the term,
// except May-June, which is due 31 August
const VAT_BIMONTHLY: DeadlineSchedule = {
  kind: "periodic",
  dates: [
    { month: 2, day: 10 }, // November-December of the year before
    { month: 4, day: 10 }, // January-February
    { month: 6, day: 10 }, // March-April
    { month: 8, day: 31 }, // May-June
    { month: 10, day: 10 }, // July-August
    { month: 12, day: 10 }, // September-October
  ],
};

const VAT_ANNUAL: DeadlineSchedule = {
  kind: "annual",
  date: { month: 3, day: 10 },
};

export const OBLIGATIONS: ObligationDefinition[] = [
  {
    id: "tax-return-enk",
    title: {
      nb: "Skattemelding med næringsspesifikasjon",
      en: "Tax return with business specification",
    },
    description: {
      nb: "Skattemeldingen for enkeltpersonforetak er den samme som for privatpersoner, med næringsopplysninger i tillegg. Den leveres elektronisk.",
      en: "The tax return for a sole proprietorship is the personal tax return with business information added. It is filed electronically.",
    },
    sourceUrl: URLS.taxReturnEnk,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "ENK",
    reason: () => ({
      nb: "Alle enkeltpersonforetak må levere skattemelding, også uten omsetning.",
      en: "Every sole proprietorship must file a tax return, even without any sales.",
    }),
    schedule: () => ({ kind: "annual", date: { month: 5, day: 31 } }),
  },
  {
    id: "tax-return-company",
    title: { nb: "Skattemelding for selskap", en: "Company tax return" },
    description: {
      nb: "Aksjeselskapet leverer sin egen skattemelding, via et regnskapssystem eller årsoppgjørsprogram.",
      en: "The limited company files its own tax return, through accounting or year-end software.",
    },
    sourceUrl: URLS.taxReturnCompany,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "AS",
    reason: () => ({
      nb: "Alle aksjeselskap må levere skattemelding, også uten omsetning.",
      en: "Every limited company must file a tax return, even without any sales.",
    }),
    schedule: () => ({ kind: "annual", date: { month: 5, day: 31 } }),
  },
  {
    id: "advance-tax-enk",
    title: { nb: "Forskuddsskatt", en: "Advance tax" },
    description: {
      nb: "Skatten på overskuddet betales på forskudd i fire like terminer i løpet av året. Beløpet bestemmes av skattekortet ditt.",
      en: "Tax on the profit is paid in advance in four equal instalments during the year. The amount follows your tax card.",
    },
    sourceUrl: URLS.advanceTaxEnk,
    altinnUrl: null,
    appliesTo: (facts) =>
      facts.organizationForm === "ENK" && facts.expectsProfit === true,
    reason: () => ({
      nb: "Du regner med overskudd, og et enkeltpersonforetak med overskudd betaler forskuddsskatt.",
      en: "You expect a profit, and a sole proprietorship with a profit pays advance tax.",
    }),
    schedule: () => ({
      kind: "periodic",
      dates: [
        { month: 3, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 12, day: 15 },
      ],
    }),
  },
  {
    id: "advance-tax-company",
    title: { nb: "Forskuddsskatt for selskap", en: "Company advance tax" },
    description: {
      nb: "Forskuddsskatten betales i to like terminer i året etter inntektsåret. Melding om beløpet kommer i januar.",
      en: "Advance tax is paid in two equal instalments in the year after the income year. The amount is announced in January.",
    },
    sourceUrl: URLS.advanceTaxAs,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "AS",
    reason: () => ({
      nb: "Aksjeselskap skal betale forskuddsskatt.",
      en: "Limited companies must pay advance tax.",
    }),
    schedule: () => ({
      kind: "periodic",
      dates: [
        { month: 2, day: 15 },
        { month: 4, day: 15 },
      ],
    }),
  },
  {
    id: "vat-return",
    title: { nb: "Mva-melding", en: "VAT return" },
    description: {
      nb: "Mva-meldingen viser hvor mye merverdiavgift som skal betales eller tilbakebetales. Betalingsfristen er den samme som leveringsfristen, og meldingen leveres også når omsetningen er null.",
      en: "The VAT return shows how much VAT is payable or refundable. Payment is due on the filing date, and the return is filed even when sales are zero.",
    },
    sourceUrl: URLS.vatReturn,
    altinnUrl: null,
    appliesTo: (facts) => facts.vatRegistered,
    reason: (facts) =>
      facts.vatTerm === "annual"
        ? {
            nb: "Foretaket er registrert i Merverdiavgiftsregisteret og leverer én gang i året (årstermin).",
            en: "The business is VAT registered and files once a year (annual term).",
          }
        : {
            nb: "Foretaket er registrert i Merverdiavgiftsregisteret.",
            en: "The business is registered in the VAT register.",
          },
    schedule: (facts) => {
      switch (facts.vatTerm) {
        case "bimonthly":
          return VAT_BIMONTHLY;
        case "annual":
          return VAT_ANNUAL;
        default:
          // The deadlines depend on the term, so none are shown until it is known
          return null;
      }
    },
  },
  {
    id: "a-melding",
    title: { nb: "A-melding", en: "A-melding (payroll report)" },
    description: {
      nb: "A-meldingen rapporterer lønn, forskuddstrekk og arbeidsgiveravgift hver måned, og status på arbeidsforhold også i måneder uten lønn.",
      en: "The a-melding reports salaries, withholding tax and employer's contribution every month, and employment status even in months without pay.",
    },
    sourceUrl: URLS.aMelding,
    altinnUrl: null,
    appliesTo: (facts) => facts.paysSalary === true,
    reason: () => ({
      nb: "Du betaler lønn, og alle arbeidsgivere må levere a-melding.",
      en: "You pay salaries, and every employer must file the a-melding.",
    }),
    schedule: () => ({ kind: "monthly", day: 5 }),
  },
  {
    id: "employer-contribution",
    title: {
      nb: "Betaling av arbeidsgiveravgift",
      en: "Payment of employer's contribution",
    },
    description: {
      nb: "Arbeidsgiveravgiften for de to foregående månedene betales annenhver måned. Forskuddstrekket betales senest første virkedag etter hver lønnsutbetaling.",
      en: "Employer's contribution for the two previous months is paid every other month. Withholding tax is paid no later than the first business day after each payday.",
    },
    sourceUrl: URLS.employerContribution,
    altinnUrl: null,
    appliesTo: (facts) => facts.paysSalary === true,
    reason: () => ({
      nb: "Du betaler lønn, og arbeidsgiver betaler arbeidsgiveravgift av lønnen.",
      en: "You pay salaries, and the employer pays employer's contribution on them.",
    }),
    schedule: () => ({
      kind: "periodic",
      dates: [
        { month: 1, day: 15 },
        { month: 3, day: 15 },
        { month: 5, day: 15 },
        { month: 7, day: 15 },
        { month: 9, day: 15 },
        { month: 11, day: 15 },
      ],
    }),
  },
  {
    id: "shareholder-register",
    title: {
      nb: "Aksjonærregisteroppgaven",
      en: "Shareholder register statement",
    },
    description: {
      nb: "Oppgaven viser hvem som eier aksjene per 31. desember, og endringer, utbytte og kapitalendringer i løpet av året.",
      en: "The statement shows who owned the shares on 31 December, and changes, dividends and capital changes during the year.",
    },
    sourceUrl: URLS.shareholderRegister,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "AS",
    reason: () => ({
      nb: "Alle aksjeselskap må levere aksjonærregisteroppgaven.",
      en: "Every limited company must file the shareholder register statement.",
    }),
    schedule: () => ({ kind: "annual", date: { month: 1, day: 31 } }),
  },
  {
    id: "general-meeting",
    title: {
      nb: "Ordinær generalforsamling",
      en: "Annual general meeting",
    },
    description: {
      nb: "Generalforsamlingen fastsetter årsregnskapet. Den holdes innen seks måneder etter regnskapsårets slutt; for små selskap kan den ofte holdes forenklet.",
      en: "The general meeting approves the annual accounts. It is held within six months after the end of the financial year; small companies can often hold it in a simplified form.",
    },
    sourceUrl: URLS.generalMeeting,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "AS",
    reason: () => ({
      nb: "Aksjeselskap må holde ordinær generalforsamling hvert år.",
      en: "Limited companies must hold an annual general meeting every year.",
    }),
    schedule: () => ({ kind: "annual", date: { month: 6, day: 30 } }),
  },
  {
    id: "annual-accounts",
    title: {
      nb: "Årsregnskap til Regnskapsregisteret",
      en: "Annual accounts to the Register of Company Accounts",
    },
    description: {
      nb: "Årsregnskapet sendes inn senest én måned etter at det er fastsatt. For å unngå forsinkelsesgebyr må det være levert innen 31. juli.",
      en: "The annual accounts are submitted no later than one month after they are approved. To avoid a late filing fee they must be submitted by 31 July.",
    },
    sourceUrl: URLS.annualAccounts,
    altinnUrl: null,
    appliesTo: (facts) => facts.organizationForm === "AS",
    reason: () => ({
      nb: "Alle aksjeselskap er regnskapspliktige og må sende inn årsregnskap.",
      en: "Every limited company is required to keep accounts and submit annual accounts.",
    }),
    schedule: () => ({ kind: "annual", date: { month: 7, day: 31 } }),
  },
  {
    id: "bookkeeping",
    title: { nb: "Bokføring", en: "Bookkeeping" },
    description: {
      nb: "Alle inntekter og kostnader skal bokføres løpende, og kvitteringer og annen dokumentasjon skal tas vare på i fem år.",
      en: "All income and expenses must be recorded continuously, and receipts and other documentation must be kept for five years.",
    },
    sourceUrl: URLS.bookkeeping,
    altinnUrl: null,
    appliesTo: () => true,
    reason: () => ({
      nb: "Alle næringsdrivende har bokføringsplikt.",
      en: "Every business has a duty to keep books.",
    }),
    // A continuous duty without a deadline
    schedule: () => null,
  },
];

export { URLS as SOURCE_URLS };
