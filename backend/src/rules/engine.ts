// The rule engine: company + answers + today's date -> obligations.
// A pure function: no database, no network and no clock of its own.
import type { Company } from "../types/company.js";
import { OBLIGATIONS } from "./obligations.js";
import { upcomingDeadlines } from "./schedule.js";
import {
  type Answers,
  type AssessmentResult,
  type CompanyFacts,
  type Facts,
  isSupportedOrganizationForm,
  type ObligationResult,
  type WindingUp,
} from "./types.js";
import { RULES_VERSION } from "./version.js";
import { WARNINGS } from "./warnings.js";

// What the rules know about a company before any question is answered.
// null when the organization form is not supported.
export function toCompanyFacts(company: Company): CompanyFacts | null {
  if (!isSupportedOrganizationForm(company.organizationForm)) {
    return null;
  }

  return {
    organizationForm: company.organizationForm,
    vatRegistered: company.vatRegistered,
    windingUp: windingUpOf(company),
    employeesHint: company.employees,
  };
}

// The most serious of Brreg's winding-up flags: a bankruptcy takes the
// obligations over from the owners, a forced liquidation is about to
// dissolve the company, an ordinary liquidation is the owners' own choice
export function windingUpOf(company: Company): WindingUp | null {
  if (company.isBankrupt) return "bankrupt";
  if (company.isUnderForcedLiquidation) return "forcedLiquidation";
  if (company.isUnderLiquidation) return "liquidation";
  return null;
}

function toFacts(company: CompanyFacts, answers: Answers): Facts {
  return {
    ...company,
    vatTerm: answers.vatTerm ?? null,
    expectsSalesOver50k: answers.expectsSalesOver50k ?? null,
    paysSalary: answers.paysSalary ?? null,
    expectsProfit: answers.expectsProfit ?? null,
  };
}

// Obligations with a deadline come first, the nearest first.
// Obligations without one keep their order from the rules, at the end.
function byNextDeadline(a: ObligationResult, b: ObligationResult): number {
  if (a.nextDeadline === b.nextDeadline) return 0;
  if (a.nextDeadline === null) return 1;
  if (b.nextDeadline === null) return -1;
  return a.nextDeadline < b.nextDeadline ? -1 : 1;
}

export function assess(
  company: Company,
  answers: Answers,
  today: Date,
): AssessmentResult {
  const companyFacts = toCompanyFacts(company);

  if (companyFacts === null) {
    return { supported: false, organizationForm: company.organizationForm };
  }

  const facts = toFacts(companyFacts, answers);

  const obligations = OBLIGATIONS.filter((definition) =>
    definition.appliesTo(facts),
  ).map((definition): ObligationResult => {
    const schedule = definition.schedule(facts);
    const upcoming = schedule ? upcomingDeadlines(schedule, today) : [];

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      reason: definition.reason(facts),
      sourceUrl: definition.sourceUrl,
      filingUrl: definition.filingUrl,
      nextDeadline: upcoming[0] ?? null,
      upcomingDeadlines: upcoming,
    };
  });

  // Array.prototype.sort is stable, so equal deadlines keep the rules' order
  obligations.sort(byNextDeadline);

  const warnings = WARNINGS.filter((definition) =>
    definition.appliesTo(facts),
  ).map((definition) => ({
    id: definition.id,
    message: definition.message,
    sourceUrl: definition.sourceUrl,
  }));

  return {
    supported: true,
    rulesVersion: RULES_VERSION,
    obligations,
    warnings,
  };
}
