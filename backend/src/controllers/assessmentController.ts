import type { Request, Response } from "express";
import { Assessment } from "../models/Assessment.js";
import { EMAIL_LANGUAGES, type EmailLanguage } from "../models/Subscription.js";
import { parseAnswers } from "../rules/answers.js";
import { assess, toCompanyFacts } from "../rules/engine.js";
import { RULES_VERSION } from "../rules/version.js";
import { toQuestionView } from "../rules/views.js";
import {
  answersNeedUpdate,
  markUsed,
  questionsForAssessment,
} from "../services/assessmentService.js";
import { lookupCompany } from "../services/brregService.js";
import { buildCalendar } from "../services/calendarService.js";
import { isValidOrgNumber } from "../utils/orgNumber.js";
import { todayInNorway } from "../utils/today.js";
import { isUuid } from "../utils/uuid.js";

// The stored assessment together with a result calculated from today's rules
function toResponse(assessment: Assessment) {
  return {
    id: assessment.id,
    orgNumber: assessment.orgNumber,
    createdAt: assessment.createdAt,
    rulesVersionAtCreation: assessment.rulesVersion,
    company: assessment.companySnapshot,
    answers: assessment.answers,
    // The company data has changed (weekly refresh from Brreg) so that the
    // answers no longer fit: GET /api/assessments/:id/questions shows the
    // questions to answer again with PATCH
    answersNeedUpdate: answersNeedUpdate(assessment),
    result: assess(
      assessment.companySnapshot,
      assessment.answers,
      todayInNorway(),
    ),
  };
}

// POST /api/assessments
export const createAssessment = async (req: Request, res: Response) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "Assess a company: its obligations, deadlines and warnings"
  /* #swagger.requestBody = {
       required: true,
       description: "orgNumber must belong to an ENK or AS. Get the questions to answer from GET /api/companies/{orgNumber}/questions.",
       content: {
         "application/json": {
           example: {
             orgNumber: "974760673",
             answers: { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true }
           }
         }
       }
     } */
  const body: unknown = req.body;
  const orgNumber =
    typeof body === "object" && body !== null && "orgNumber" in body
      ? body.orgNumber
      : undefined;
  const rawAnswers =
    typeof body === "object" && body !== null && "answers" in body
      ? body.answers
      : undefined;

  if (!isValidOrgNumber(orgNumber)) {
    res.status(400).json({ error: "Invalid organization number" });
    return;
  }

  let lookup: Awaited<ReturnType<typeof lookupCompany>>;
  try {
    lookup = await lookupCompany(orgNumber);
  } catch (error: unknown) {
    req.log.error({ err: error }, "Brreg lookup failed");
    res.status(502).json({ error: "Could not reach the Brreg API" });
    return;
  }

  if (lookup.status === "deleted") {
    res.status(410).json({ error: "Company has been struck off the register" });
    return;
  }
  if (lookup.status === "notFound") {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const company = lookup.company;
  const facts = toCompanyFacts(company);

  if (facts === null) {
    res.status(422).json({
      error: "This organization form is not supported yet",
      organizationForm: company.organizationForm,
    });
    return;
  }

  const parsed = parseAnswers(rawAnswers ?? {}, facts);

  if (!parsed.ok) {
    res.status(400).json({ error: "Invalid answers", details: parsed.errors });
    return;
  }

  const assessment = await Assessment.create({
    orgNumber,
    companySnapshot: company,
    answers: parsed.answers,
    rulesVersion: RULES_VERSION,
  });

  res.status(201).json(toResponse(assessment));
};

// GET /api/assessments/:id
export const getAssessmentById = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "A stored assessment, recalculated with today's date"
  const { id } = req.params;

  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid assessment id" });
    return;
  }

  const assessment = await Assessment.findByPk(id);

  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  await markUsed(assessment);
  res.json(toResponse(assessment));
};

// The stored assessment for :id, or an answer saying why there is none
async function findAssessment(
  req: Request<{ id: string }>,
  res: Response,
): Promise<Assessment | null> {
  const { id } = req.params;

  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid assessment id" });
    return null;
  }

  const assessment = await Assessment.findByPk(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return null;
  }
  return assessment;
}

// GET /api/assessments/:id/questions
export const getAssessmentQuestions = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "The questions for changing an assessment's answers, with the current answers"
  /* #swagger.description = "From the stored company data, so they match what PATCH accepts. Brreg is not called." */
  const assessment = await findAssessment(req, res);
  if (!assessment) return;

  const questions = questionsForAssessment(assessment);
  await markUsed(assessment);

  res.json({
    supported: questions !== null,
    organizationForm: assessment.companySnapshot.organizationForm,
    questions: (questions ?? []).map(toQuestionView),
    answers: assessment.answers,
  });
};

// PATCH /api/assessments/:id
export const updateAnswers = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "Change an assessment's answers"
  /* #swagger.description = "All the questions from GET /api/assessments/{id}/questions must be answered again. Reminder subscriptions and the record of sent reminders are kept; the next reminders follow the new answers." */
  /* #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           example: { answers: { vatTerm: "bimonthly", paysSalary: true, expectsProfit: true } }
         }
       }
     } */
  const assessment = await findAssessment(req, res);
  if (!assessment) return;

  const facts = toCompanyFacts(assessment.companySnapshot);
  if (facts === null) {
    res.status(422).json({
      error: "This organization form is not supported yet",
      organizationForm: assessment.companySnapshot.organizationForm,
    });
    return;
  }

  const body: unknown = req.body;
  const rawAnswers =
    typeof body === "object" && body !== null && "answers" in body
      ? body.answers
      : undefined;
  const parsed = parseAnswers(rawAnswers ?? {}, facts);

  if (!parsed.ok) {
    res.status(400).json({ error: "Invalid answers", details: parsed.errors });
    return;
  }

  await assessment.update({
    answers: parsed.answers,
    lastAccessedAt: new Date(),
  });
  res.json(toResponse(assessment));
};

// GET /api/assessments/:id/calendar.ics
export const getAssessmentCalendar = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "The deadlines as a calendar to subscribe to (iCalendar)"
  /* #swagger.description = "For Google Calendar, Outlook or Apple Calendar. They fetch it again now and then, so the calendar follows changed answers and company data. Every deadline is a whole-day event with an alert three days before." */
  /* #swagger.parameters['lang'] = { in: "query", description: "nb (default) or en", required: false, type: "string" } */
  /* #swagger.produces = ["text/calendar"] */
  const lang = req.query.lang ?? "nb";
  if (!(EMAIL_LANGUAGES as readonly unknown[]).includes(lang)) {
    res
      .status(400)
      .json({ error: `lang must be one of: ${EMAIL_LANGUAGES.join(", ")}` });
    return;
  }

  const assessment = await findAssessment(req, res);
  if (!assessment) return;

  await markUsed(assessment);
  res
    .type("text/calendar; charset=utf-8")
    .set(
      "Content-Disposition",
      `inline; filename="regelvakt-${assessment.orgNumber}.ics"`,
    )
    // Calendar apps fetch it again; nothing in between should keep a copy
    .set("Cache-Control", "no-store")
    .send(buildCalendar(assessment, lang as EmailLanguage));
};

// DELETE /api/assessments/:id
export const deleteAssessment = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Assessments"]
  // #swagger.summary = "Delete an assessment and its reminders"
  /* #swagger.description = "Deletes the assessment, every reminder subscription for it (email addresses included) and the record of sent reminders. Anyone with the assessment's id can do this." */
  const { id } = req.params;

  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid assessment id" });
    return;
  }

  // The database deletes the subscriptions and their deliveries with it
  const deleted = await Assessment.destroy({ where: { id } });

  if (deleted === 0) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  res.status(204).end();
};
