// Types shared by the rule engine: what goes in, how rules are described
// and what comes out. The rules themselves live in this folder as code.

// Organization forms the rules are written for. Any other form gets a
// "not supported yet" result instead of a guess.
export const SUPPORTED_ORGANIZATION_FORMS = ["ENK", "AS"] as const;
export type SupportedOrganizationForm =
  (typeof SUPPORTED_ORGANIZATION_FORMS)[number];

export function isSupportedOrganizationForm(
  form: string,
): form is SupportedOrganizationForm {
  return (SUPPORTED_ORGANIZATION_FORMS as readonly string[]).includes(form);
}

// Every text shown to the user exists in Norwegian (bokmål) and English
export interface LocalizedText {
  nb: string;
  en: string;
}

// Dates are calendar dates without a time of day, written as YYYY-MM-DD
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Input

// How often a VAT registered business files its VAT return
export type VatTerm = "bimonthly" | "annual" | "unknown";

// The user's answers. A question that was not asked is left out.
export interface Answers {
  vatTerm?: VatTerm;
  expectsSalesOver50k?: boolean;
  paysSalary?: boolean;
  expectsProfit?: boolean;
}

export type QuestionId = keyof Answers;

// What the rules know about the company before any question is answered
// Brreg's flags for a company that is being wound up. null when none is set.
export type WindingUp = "bankrupt" | "forcedLiquidation" | "liquidation";

export interface CompanyFacts {
  organizationForm: SupportedOrganizationForm;
  vatRegistered: boolean;
  windingUp: WindingUp | null;
  // Employee count from Brreg; only a hint, since Brreg often leaves it out
  employeesHint: number | null;
}

// Everything the obligation rules decide on. An unanswered question is null.
export interface Facts extends CompanyFacts {
  vatTerm: VatTerm | null;
  expectsSalesOver50k: boolean | null;
  paysSalary: boolean | null;
  expectsProfit: boolean | null;
}

// ---------------------------------------------------------------------------
// Rule descriptions

interface QuestionBase {
  id: QuestionId;
  text: LocalizedText;
  help?: LocalizedText;
  // The question is only asked when this returns true
  askWhen: (company: CompanyFacts) => boolean;
}

export interface BooleanQuestion extends QuestionBase {
  type: "boolean";
}

export interface ChoiceQuestion extends QuestionBase {
  type: "choice";
  options: { value: string; label: LocalizedText }[];
}

export type QuestionDefinition = BooleanQuestion | ChoiceQuestion;

export interface MonthDay {
  month: number; // 1-12
  day: number; // 1-31
}

// When an obligation is due. Deadlines that fall on a weekend or a public
// holiday move to the next business day, unless `fixed` is set.
export type DeadlineSchedule =
  // Once a year on the same date, e.g. 31 May
  (
    | { kind: "annual"; date: MonthDay }
    // On fixed dates through the year, e.g. the VAT terms
    | { kind: "periodic"; dates: MonthDay[] }
    // On the same day every month, e.g. the 5th
    | { kind: "monthly"; day: number }
  ) & {
    // The date holds on a weekend or a public holiday too. Used where the
    // official source does not say the deadline moves: an early reminder
    // costs nothing, a late one can cost a fee.
    fixed?: true;
  };

export interface ObligationDefinition {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  // Who the obligation applies to, in general terms. Given to the
  // assistant, so it can answer for any company.
  audience: LocalizedText;
  // Every deadline the obligation can have, in words. Each date in it must
  // be one of the schedule's dates (checked by tests/ruleTexts.test.ts).
  deadlineText: LocalizedText;
  // The official page that explains the obligation
  sourceUrl: string;
  // Where it is filed or paid, when there is one service everybody uses;
  // null when it is done from an accounting system or there are several ways
  filingUrl: string | null;
  appliesTo: (facts: Facts) => boolean;
  // Why the obligation applies to this company, shown to the user
  reason: (facts: Facts) => LocalizedText;
  // null when the deadlines cannot be known from the facts
  schedule: (facts: Facts) => DeadlineSchedule | null;
}

export interface WarningDefinition {
  id: string;
  appliesTo: (facts: Facts) => boolean;
  message: LocalizedText;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Output

export interface ObligationResult {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  reason: LocalizedText;
  sourceUrl: string;
  filingUrl: string | null;
  nextDeadline: IsoDate | null;
  // Deadlines in the next twelve months, the next one first
  upcomingDeadlines: IsoDate[];
}

export interface WarningResult {
  id: string;
  message: LocalizedText;
  sourceUrl: string;
}

export type AssessmentResult =
  | { supported: false; organizationForm: string }
  | {
      supported: true;
      rulesVersion: string;
      obligations: ObligationResult[];
      warnings: WarningResult[];
    };
