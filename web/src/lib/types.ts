// The shapes the API sends. They mirror backend/src (types/company.ts,
// rules/types.ts, rules/views.ts and the assessment controller).
import type { IsoDate } from "./dates";

export interface LocalizedText {
  nb: string;
  en: string;
}

export interface Company {
  orgNumber: string;
  name: string;
  organizationForm: string;
  organizationFormDescription: string;
  address: {
    postalCode: string | null;
    city: string | null;
    municipality: string | null;
    municipalityNumber: string | null;
  } | null;
  industryCode: string | null;
  industryDescription: string | null;
  employees: number | null;
  hasRegisteredEmployees: boolean;
  foundedDate: IsoDate | null;
  registrationDate: IsoDate | null;
  vatRegistered: boolean;
  businessRegisterRegistered: boolean;
  isBankrupt: boolean;
  isUnderLiquidation: boolean;
  isUnderForcedLiquidation: boolean;
}

export interface Question {
  id: string;
  type: "boolean" | "choice";
  text: LocalizedText;
  help: LocalizedText | null;
  options: { value: string; label: LocalizedText }[] | null;
}

// A question's answer: true or false, or one of its options
export type AnswerValue = boolean | string;
export type Answers = Record<string, AnswerValue>;

export interface QuestionsResponse {
  supported: boolean;
  organizationForm: string;
  questions: Question[];
}

// GET /api/assessments/:id/questions
export interface AssessmentQuestionsResponse extends QuestionsResponse {
  answers: Answers;
}

export interface Obligation {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  reason: LocalizedText;
  sourceUrl: string;
  filingUrl: string | null;
  nextDeadline: IsoDate | null;
  upcomingDeadlines: IsoDate[];
}

export interface Warning {
  id: string;
  message: LocalizedText;
  sourceUrl: string;
}

export type AssessmentResult =
  | { supported: false; organizationForm: string }
  | {
      supported: true;
      rulesVersion: string;
      obligations: Obligation[];
      warnings: Warning[];
    };

export interface Assessment {
  id: string;
  orgNumber: string;
  createdAt: string;
  rulesVersionAtCreation: string;
  company: Company;
  answers: Answers;
  answersNeedUpdate: boolean;
  result: AssessmentResult;
}
