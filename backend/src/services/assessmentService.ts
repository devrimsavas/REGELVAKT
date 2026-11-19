// What the API does with a stored assessment besides creating it: keep
// track of its use, and tell whether its answers still fit the company.
import { Op } from "sequelize";
import { Assessment } from "../models/Assessment.js";
import { parseAnswers, questionsFor } from "../rules/answers.js";
import { toCompanyFacts } from "../rules/engine.js";
import type { QuestionDefinition } from "../rules/types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Records that the assessment was used. Written at most once a day, so
// reading a page or a calendar app fetching it every hour does not write to
// the database every time. updatedAt is left alone: nothing in the
// assessment changed.
export async function markUsed(
  assessment: Assessment,
  now = new Date(),
): Promise<void> {
  if (now.getTime() - assessment.lastAccessedAt.getTime() < DAY_MS) return;

  await Assessment.update(
    { lastAccessedAt: now },
    {
      where: {
        id: assessment.id,
        lastAccessedAt: { [Op.lt]: new Date(now.getTime() - DAY_MS) },
      },
      silent: true,
    },
  );
  assessment.lastAccessedAt = now;
}

// The questions the company is asked today, from the stored company data.
// null when its organization form is not supported (any more).
export function questionsForAssessment(
  assessment: Assessment,
): QuestionDefinition[] | null {
  const facts = toCompanyFacts(assessment.companySnapshot);
  return facts === null ? null : questionsFor(facts);
}

// The stored answers no longer fit the questions. This happens when the
// weekly refresh from Brreg changes the company, such as a new VAT
// registration: then there is a new question to answer (the VAT term),
// and the deadlines that depend on it are unknown until it is answered.
export function answersNeedUpdate(assessment: Assessment): boolean {
  const facts = toCompanyFacts(assessment.companySnapshot);
  return facts !== null && !parseAnswers(assessment.answers, facts).ok;
}
