// Checks the answers sent by a client against the questions the company
// is actually asked.
import { QUESTIONS } from "./questions.js";
import type { Answers, CompanyFacts, QuestionDefinition } from "./types.js";

export type AnswersResult =
  | { ok: true; answers: Answers }
  | { ok: false; errors: string[] };

// The questions this company is asked, in order
export function questionsFor(company: CompanyFacts): QuestionDefinition[] {
  return QUESTIONS.filter((question) => question.askWhen(company));
}

// Every asked question must be answered with a valid value.
// Answers to questions that are not asked, or unknown keys, are errors.
export function parseAnswers(input: unknown, company: CompanyFacts): AnswersResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["Answers must be an object"] };
  }

  const raw = input as Record<string, unknown>;
  const asked = questionsFor(company);
  const askedIds = new Set<string>(asked.map((question) => question.id));
  const errors: string[] = [];
  const answers: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    if (!askedIds.has(key)) {
      errors.push(`'${key}' is not a question for this company`);
    }
  }

  for (const question of asked) {
    const value = raw[question.id];

    if (value === undefined) {
      errors.push(`'${question.id}' must be answered`);
      continue;
    }

    if (question.type === "boolean" && typeof value !== "boolean") {
      errors.push(`'${question.id}' must be true or false`);
      continue;
    }

    if (
      question.type === "choice" &&
      !question.options.some((option) => option.value === value)
    ) {
      const allowed = question.options.map((option) => option.value).join(", ");
      errors.push(`'${question.id}' must be one of: ${allowed}`);
      continue;
    }

    answers[question.id] = value;
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, answers: answers as Answers };
}
