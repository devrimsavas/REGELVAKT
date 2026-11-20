// The obligations Regelvakt knows about, for ENK and AS.
// Deadlines and rules verified against Skatteetaten and Brønnøysundregistrene
// in November 2026 (see RULES_VERSION). Every source and filing link was
// checked on 19 November 2026; the annual accounts and general meeting
// links were corrected on 20 November 2026.
import type { DeadlineSchedule, ObligationDefinition } from "./types.js";

const URLS = {
  vatReturn:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/mva-melding/",
  vatAnnualTerm:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/betale-mva/sma-virksomheter-kan-soke-om-a-rapportere-mva-en-gang-i-aret/",
  taxReturnEnk:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-naringsdrivende/enk/",
  taxReturnCompany:
    "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-naringsdrivende/selskap/",
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
  annualAccounts: "https://www.brreg.no/innsending-av-arsregnskap/",
  // Brreg's own explanation; Lovdata's text of the law (aksjeloven § 5-5)
  // does not allow automatic reading in its robots.txt
  generalMeeting:
    "https://www.brreg.no/aksjeselskap/generalforsamling-i-aksjeselskap/",
  bookkeeping:
    "https://www.skatteetaten.no/nn/bedrift-og-organisasjon/starte-og-drive/rutiner-regnskap-og-kassasystem/gode-rutiner-for-daglig-drift/regnskap/",
} as const;

// Where to file or pay, for the obligations that have one common service
const FILING_URLS = {
  vatReturn: "https://skatt.skatteetaten.no/web/mva/",
  // For employers without a payroll system; others file from that system
  aMelding:
    "https://www.skatteetaten.no/skjema/direkte-levering-av-a-meldingen/",
  annualAccounts:
    "https://info.altinn.no/en/forms-overview/bronnoysund-register-centre/annual-accounts/",
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
    audience: {
      nb: "Alle enkeltpersonforetak, også de uten omsetning.",
      en: "Every sole proprietorship, also those without sales.",
    },
    deadlineText: {
      nb: "Leveres innen 31. mai i året etter inntektsåret.",
      en: "Filed by 31 May in the year after the income year.",
    },
    sourceUrl: URLS.taxReturnEnk,
    filingUrl: null,
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
    audience: {
      nb: "Alle aksjeselskap, også de uten omsetning.",
      en: "Every limited company, also those without sales.",
    },
    deadlineText: {
      nb: "Leveres innen 31. mai i året etter inntektsåret.",
      en: "Filed by 31 May in the year after the income year.",
    },
    sourceUrl: URLS.taxReturnCompany,
    filingUrl: null,
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
    audience: {
      nb: "Enkeltpersonforetak som venter overskudd. Beløpet står på skattekortet.",
      en: "Sole proprietorships that expect a profit. The amount is on the tax card.",
    },
    deadlineText: {
      nb: "Betales i fire like terminer i inntektsåret: 15. mars, 15. juni, 15. september og 15. desember.",
      en: "Paid in four equal instalments during the income year: 15 March, 15 June, 15 September and 15 December.",
    },
    sourceUrl: URLS.advanceTaxEnk,
    filingUrl: null,
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
    audience: {
      nb: "Aksjeselskap.",
      en: "Limited companies.",
    },
    deadlineText: {
      nb: "Betales i to like terminer i året etter inntektsåret: 15. februar og 15. april.",
      en: "Paid in two equal instalments in the year after the income year: 15 February and 15 April.",
    },
    sourceUrl: URLS.advanceTaxAs,
    filingUrl: null,
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
    audience: {
      nb: "Virksomheter som er registrert i Merverdiavgiftsregisteret. De fleste leverer annenhver måned (alminnelig termin); små virksomheter kan søke om å levere én gang i året (årstermin).",
      en: "Businesses registered in the VAT register. Most file every two months (the ordinary term); small businesses can apply to file once a year (the annual term).",
    },
    deadlineText: {
      nb: "Alminnelig termin, annenhver måned: januar–februar innen 10. april, mars–april innen 10. juni, mai–juni innen 31. august, juli–august innen 10. oktober, september–oktober innen 10. desember, november–desember innen 10. februar året etter. Årstermin: innen 10. mars året etter. Betalingsfristen er den samme som leveringsfristen.",
      en: "Ordinary term, every two months: January–February by 10 April, March–April by 10 June, May–June by 31 August, July–August by 10 October, September–October by 10 December, November–December by 10 February the year after. Annual term: by 10 March the year after. Payment is due on the same date as the return.",
    },
    sourceUrl: URLS.vatReturn,
    filingUrl: FILING_URLS.vatReturn,
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
    audience: {
      nb: "Alle som betaler lønn.",
      en: "Everyone who pays salaries.",
    },
    deadlineText: {
      nb: "Leveres innen den 5. hver måned, for måneden før.",
      en: "Filed by the 5th of every month, for the month before.",
    },
    sourceUrl: URLS.aMelding,
    filingUrl: FILING_URLS.aMelding,
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
    audience: {
      nb: "Alle som betaler lønn.",
      en: "Everyone who pays salaries.",
    },
    deadlineText: {
      nb: "Arbeidsgiveravgiften for de to foregående månedene betales 15. januar, 15. mars, 15. mai, 15. juli, 15. september og 15. november. Forskuddstrekket betales senest første virkedag etter hver lønnsutbetaling.",
      en: "Employer's contribution for the two previous months is paid on 15 January, 15 March, 15 May, 15 July, 15 September and 15 November. Withholding tax is paid no later than the first business day after each payday.",
    },
    sourceUrl: URLS.employerContribution,
    filingUrl: null,
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
    audience: {
      nb: "Aksjeselskap.",
      en: "Limited companies.",
    },
    deadlineText: {
      nb: "Leveres innen 31. januar i året etter inntektsåret.",
      en: "Filed by 31 January in the year after the income year.",
    },
    sourceUrl: URLS.shareholderRegister,
    filingUrl: null,
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
    audience: {
      nb: "Aksjeselskap.",
      en: "Limited companies.",
    },
    deadlineText: {
      nb: "Holdes innen seks måneder etter at regnskapsåret er slutt, det vil si innen 30. juni når regnskapsåret er kalenderåret.",
      en: "Held within six months after the end of the financial year, that is by 30 June when the financial year is the calendar year.",
    },
    sourceUrl: URLS.generalMeeting,
    filingUrl: null,
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
    audience: {
      nb: "Aksjeselskap; alle aksjeselskap er regnskapspliktige.",
      en: "Limited companies; every limited company must keep accounts.",
    },
    deadlineText: {
      nb: "Sendes inn senest én måned etter at generalforsamlingen har fastsatt det, og senest 31. juli for å unngå forsinkelsesgebyr.",
      en: "Submitted no later than one month after the general meeting has approved it, and by 31 July to avoid a late filing fee.",
    },
    sourceUrl: URLS.annualAccounts,
    filingUrl: FILING_URLS.annualAccounts,
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
    audience: {
      nb: "Alle næringsdrivende.",
      en: "Every business.",
    },
    deadlineText: {
      nb: "Ingen fast frist: inntekter og kostnader bokføres løpende, og dokumentasjonen oppbevares i fem år.",
      en: "No fixed deadline: income and expenses are recorded continuously, and the documentation is kept for five years.",
    },
    sourceUrl: URLS.bookkeeping,
    filingUrl: null,
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
