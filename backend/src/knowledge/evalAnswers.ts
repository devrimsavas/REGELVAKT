// Questions with the facts a right answer must hold, and the ones it must
// not. Used by `npm run eval:answers`, which asks the real language model
// and checks each answer, so a change to the prompt, the sources or the
// model can be measured instead of guessed.
//
// The facts are dates, written as patterns because a model can write
// "10. april", "10. april 2027" or, in English, "10 April" or "April 10".
// A question about a company is asked as of EVAL_TODAY, so its next
// deadlines do not change from one run to the next.
import type { EmailLanguage } from "../models/Subscription.js";
import type { Answers } from "../rules/types.js";
import type { Company } from "../types/company.js";

export const EVAL_TODAY = new Date("2026-11-20T00:00:00Z");

export interface EvalCompany {
  company: Company;
  answers: Answers;
}

export interface AnswerCheck {
  question: string;
  language: EmailLanguage;
  // Asked about this company; without one, about any company
  about: EvalCompany | null;
  // Every pattern must be found in the answer
  mustContain: RegExp[];
  // None of these may be found
  mustNotContain: RegExp[];
}

// Fictional companies; only the fields the rules use matter
const BASE: Company = {
  orgNumber: "000000000",
  name: "Eksempel",
  organizationForm: "ENK",
  organizationFormDescription: "Enkeltpersonforetak",
  address: null,
  industryCode: null,
  industryDescription: null,
  employees: null,
  hasRegisteredEmployees: false,
  foundedDate: null,
  registrationDate: null,
  vatRegistered: true,
  businessRegisterRegistered: false,
  isBankrupt: false,
  isUnderLiquidation: false,
  isUnderForcedLiquidation: false,
};

const ENK_BIMONTHLY_VAT: EvalCompany = {
  company: BASE,
  answers: { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true },
};

const AS_WITHOUT_SALARY: EvalCompany = {
  company: {
    ...BASE,
    organizationForm: "AS",
    organizationFormDescription: "Aksjeselskap",
    vatRegistered: false,
    businessRegisterRegistered: true,
  },
  answers: { expectsSalesOver50k: false, paysSalary: false },
};

// "10. april" or "10 April" or "April 10", with any year after it
function date(day: number, monthNb: string, monthEn = monthNb): RegExp {
  return new RegExp(
    `\\b${day}\\.? (${monthNb}|${monthEn})\\b|\\b${monthEn} ${day}\\b`,
    "i",
  );
}

export const ANSWER_CHECKS: AnswerCheck[] = [
  {
    // The question that started it: only the annual and the agricultural
    // terms were named, not the common two-month one
    question: "Når må jeg levere mva-meldingen?",
    language: "nb",
    about: null,
    mustContain: [
      date(10, "april"),
      date(10, "juni"),
      date(31, "august"),
      date(10, "oktober"),
      date(10, "desember"),
      date(10, "februar"),
      date(10, "mars"),
    ],
    mustNotContain: [],
  },
  {
    question: "When is the VAT return due?",
    language: "en",
    about: null,
    mustContain: [date(10, "april"), date(31, "august")],
    mustNotContain: [],
  },
  {
    question: "Når er min neste frist for mva-meldingen?",
    language: "nb",
    about: ENK_BIMONTHLY_VAT,
    mustContain: [date(10, "desember")],
    // The annual term does not apply to this company
    mustNotContain: [date(10, "mars")],
  },
  {
    question: "Når er fristen for a-meldingen?",
    language: "nb",
    about: null,
    mustContain: [/\b5\.? (hver|i hver|i måneden|i neste)|\bden 5\./i],
    mustNotContain: [],
  },
  {
    question: "Når må skattemeldingen for enkeltpersonforetak leveres?",
    language: "nb",
    about: null,
    mustContain: [date(31, "mai", "may")],
    // The deadline for employees and pensioners, not for businesses
    mustNotContain: [date(30, "april")],
  },
  {
    question: "Når må et aksjeselskap betale forskuddsskatt?",
    language: "nb",
    about: null,
    mustContain: [date(15, "februar"), date(15, "april")],
    // The sole proprietorship's instalments
    mustNotContain: [date(15, "september")],
  },
  {
    question: "Når betales arbeidsgiveravgiften?",
    language: "nb",
    about: null,
    mustContain: [date(15, "januar"), date(15, "november")],
    mustNotContain: [],
  },
  {
    question: "Når må årsregnskapet sendes til Regnskapsregisteret?",
    language: "nb",
    about: null,
    mustContain: [date(31, "juli")],
    mustNotContain: [],
  },
  {
    question: "Når må generalforsamlingen holdes?",
    language: "nb",
    about: AS_WITHOUT_SALARY,
    mustContain: [date(30, "juni")],
    mustNotContain: [],
  },
  {
    // Nothing about this in the sources: the answer must say so, not guess
    question: "Hvor mye torsk kan jeg fiske i året?",
    language: "nb",
    about: null,
    mustContain: [
      /fant ikke|står ikke|ikke noe|ingen informasjon|skatteetaten\.no/i,
    ],
    mustNotContain: [/\d+\s*(kg|kilo|tonn)/i],
  },
];

// The patterns an answer misses or holds that it should not
export function checkAnswer(
  check: AnswerCheck,
  answer: string,
): { missing: RegExp[]; forbidden: RegExp[] } {
  return {
    missing: check.mustContain.filter((pattern) => !pattern.test(answer)),
    forbidden: check.mustNotContain.filter((pattern) => pattern.test(answer)),
  };
}
