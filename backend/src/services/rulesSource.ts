// Source [1] of every assistant answer: what Regelvakt's own rules say.
//
// The official pages explain the obligations well, but the search does not
// always find the section with the right deadline (a question about the VAT
// deadline found the annual and the agricultural terms, not the common
// two-month one). The rules hold every deadline, verified against the
// official pages, so the model is told to take dates from here and the
// explanations from the pages.
//
// With an assessment, the source is about that company: the obligations
// that apply to it, why, and its next deadlines. Without one, it lists every
// obligation with who it applies to and all its deadlines. The text is in
// Norwegian, like the pages; the title and the excerpt shown to the user
// are in the user's language.
import type { EmailLanguage } from "../models/Subscription.js";
import { fromIsoDate } from "../rules/calendar.js";
import { assess, toCompanyFacts, toFacts } from "../rules/engine.js";
import { OBLIGATIONS } from "../rules/obligations.js";
import {
  type DeadlineDetail,
  upcomingDeadlineDetails,
} from "../rules/schedule.js";
import type { Answers, IsoDate } from "../rules/types.js";
import { RULES_VERSION } from "../rules/version.js";
import type { Company } from "../types/company.js";
import { webAppUrl } from "../utils/webAppUrl.js";

export interface RulesSource {
  title: string;
  heading: string;
  // The assessment's page in the web app; null for the general rules
  url: string | null;
  excerpt: string;
  // What the model is given
  text: string;
}

const MONTHS_NB = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

const WEEKDAYS_NB = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
];

// 2026-12-10 -> "10. desember 2026"
export function formatDateNb(isoDate: IsoDate): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day}. ${MONTHS_NB[(month ?? 1) - 1]} ${year}`;
}

// A deadline, with the date it was moved from when the rules moved it:
// "2. august 2027 (flyttet fra lørdag 31. juli)". Without that, the model
// took a moved date and the pages' own date for a contradiction.
export function formatDeadlineNb(deadline: DeadlineDetail): string {
  const date = formatDateNb(deadline.date);
  if (deadline.date === deadline.nominal) return date;
  const nominal = fromIsoDate(deadline.nominal);
  const weekday = nominal.getUTCDay();
  const why =
    weekday === 0 || weekday === 6 ? WEEKDAYS_NB[weekday] : "helligdagen";
  const [, month, day] = deadline.nominal.split("-").map(Number);
  return `${date} (flyttet fra ${why} ${day}. ${MONTHS_NB[(month ?? 1) - 1]})`;
}

const INTRO = [
  `Regelvakts regler (versjon ${RULES_VERSION}), kontrollert mot Skatteetatens og Brønnøysundregistrenes sider.`,
  "De fleste fristene flyttes til neste virkedag når de faller på en lørdag, søndag eller helligdag.",
].join(" ");

const TEXT = {
  nb: {
    title: "Regelvakt",
    generalHeading: "Pliktene og fristene i Regelvakts regler",
    companyHeading: "Pliktene og fristene for dette foretaket",
    generalExcerpt: `Fristene i Regelvakts regler (versjon ${RULES_VERSION}), kontrollert mot de offisielle sidene.`,
    companyExcerpt: (count: number) =>
      `Fristene Regelvakt har regnet ut for foretaket: ${count} plikter (regler versjon ${RULES_VERSION}).`,
  },
  en: {
    title: "Regelvakt",
    generalHeading: "The obligations and deadlines in Regelvakt's rules",
    companyHeading: "The obligations and deadlines for this business",
    generalExcerpt: `The deadlines in Regelvakt's rules (version ${RULES_VERSION}), checked against the official pages.`,
    companyExcerpt: (count: number) =>
      `The deadlines Regelvakt has worked out for the business: ${count} obligations (rules version ${RULES_VERSION}).`,
  },
} as const;

// Every obligation, for any company
export function generalRulesSource(language: EmailLanguage): RulesSource {
  const t = TEXT[language];
  const blocks = OBLIGATIONS.map((obligation) =>
    [
      `${obligation.title.nb}`,
      `Gjelder: ${obligation.audience.nb}`,
      `Frist: ${obligation.deadlineText.nb}`,
      `Mer: ${obligation.sourceUrl}`,
    ].join("\n"),
  );
  return {
    title: t.title,
    heading: t.generalHeading,
    url: null,
    excerpt: t.generalExcerpt,
    text: [
      INTRO,
      "Reglene gjelder enkeltpersonforetak (ENK) og aksjeselskap (AS).",
      ...blocks,
    ].join("\n\n"),
  };
}

function describeAnswers(answers: Answers): string[] {
  const lines: string[] = [];
  if (answers.vatTerm === "bimonthly")
    lines.push("Leverer mva-melding annenhver måned (alminnelig termin).");
  if (answers.vatTerm === "annual")
    lines.push("Leverer mva-melding én gang i året (årstermin).");
  if (answers.vatTerm === "unknown")
    lines.push("Vet ikke hvilken mva-termin foretaket har.");
  if (answers.paysSalary === true) lines.push("Betaler lønn.");
  if (answers.paysSalary === false) lines.push("Betaler ikke lønn.");
  if (answers.expectsProfit === true) lines.push("Venter overskudd.");
  if (answers.expectsProfit === false) lines.push("Venter ikke overskudd.");
  if (answers.expectsSalesOver50k === true)
    lines.push(
      "Venter mva-pliktig salg over 50 000 kroner i løpet av 12 måneder.",
    );
  if (answers.expectsSalesOver50k === false)
    lines.push(
      "Venter ikke mva-pliktig salg over 50 000 kroner i løpet av 12 måneder.",
    );
  return lines;
}

// How many deadlines the summary at the top lists
const NEXT_SHOWN = 6;

// The company's next deadlines across all its obligations, earliest first.
// Each obligation lists its own dates further down; without this line a
// model asked for "the next deadline" took the first obligation it read
// (the VAT return, 10 December) over an earlier one (the a-melding,
// 7 December).
function nextDeadlinesLine(
  obligations: { title: { nb: string }; upcomingDeadlines: IsoDate[] }[],
): string[] {
  const next = obligations
    .flatMap((obligation) =>
      obligation.upcomingDeadlines.map((date) => ({
        date,
        title: obligation.title.nb,
      })),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    )
    .slice(0, NEXT_SHOWN);
  if (next.length === 0) return [];
  return [
    `De neste fristene for foretaket, alle plikter samlet, den første først: ${next
      .map(({ date, title }) => `${formatDateNb(date)} (${title})`)
      .join("; ")}.`,
  ];
}

function answersLine(answers: Answers): string[] {
  const lines = describeAnswers(answers);
  return lines.length > 0 ? [`Brukerens svar: ${lines.join(" ")}`] : [];
}

// The obligations of one company, as the rules work them out today.
// The company's name is left out: the model does not need it.
export function companyRulesSource(
  assessment: { id: string; companySnapshot: Company; answers: Answers },
  today: Date,
  language: EmailLanguage,
): RulesSource {
  const company = assessment.companySnapshot;
  // A form the rules do not cover gets the general rules, which say so
  const companyFacts = toCompanyFacts(company);
  const result = assess(company, assessment.answers, today);
  if (companyFacts === null || !result.supported)
    return generalRulesSource(language);
  const facts = toFacts(companyFacts, assessment.answers);

  const t = TEXT[language];
  const form =
    company.organizationForm === "ENK"
      ? "Enkeltpersonforetak (ENK)"
      : "Aksjeselskap (AS)";
  const vat = company.vatRegistered
    ? "registrert i Merverdiavgiftsregisteret"
    : "ikke registrert i Merverdiavgiftsregisteret";

  // The company's own dates when the rules know them. Otherwise the
  // general text: every deadline that can apply (the VAT return before the
  // term is known), or that there is no fixed one (bookkeeping).
  const blocks = result.obligations.map((obligation) => {
    const definition = OBLIGATIONS.find((d) => d.id === obligation.id);
    const schedule = definition?.schedule(facts) ?? null;
    const details = schedule ? upcomingDeadlineDetails(schedule, today) : [];
    const deadlines =
      details.length > 0
        ? `Fristene de neste tolv månedene: ${details.map(formatDeadlineNb).join(", ")}.`
        : `Frister: ${definition?.deadlineText.nb ?? "ukjent"}`;
    return [
      obligation.title.nb,
      `Hvorfor: ${obligation.reason.nb}`,
      deadlines,
      `Mer: ${obligation.sourceUrl}`,
    ].join("\n");
  });

  const warnings = result.warnings.map(
    (warning) => `Advarsel: ${warning.message.nb}`,
  );

  return {
    title: t.title,
    heading: t.companyHeading,
    url: `${webAppUrl()}/assessments/${assessment.id}`,
    excerpt: t.companyExcerpt(result.obligations.length),
    text: [
      INTRO,
      `Foretaket: ${form}, ${vat}. Dagens dato: ${formatDateNb(today.toISOString().slice(0, 10))}. Der en dato under er flyttet fra en helg eller helligdag, står den opprinnelige datoen i parentes.`,
      ...answersLine(assessment.answers),
      ...warnings,
      ...nextDeadlinesLine(result.obligations),
      ...blocks,
    ].join("\n\n"),
  };
}
