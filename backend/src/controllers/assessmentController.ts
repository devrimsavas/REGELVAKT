import type { Request, Response } from "express";
import { Assessment } from "../models/Assessment.js";
import { lookupCompany } from "../services/brregService.js";
import { isValidOrgNumber } from "../utils/orgNumber.js";
import { todayInNorway } from "../utils/today.js";
import { assess, toCompanyFacts } from "../rules/engine.js";
import { parseAnswers } from "../rules/answers.js";
import { RULES_VERSION } from "../rules/version.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The stored assessment together with a result calculated from today's rules
function toResponse(assessment: Assessment) {
  return {
    id: assessment.id,
    orgNumber: assessment.orgNumber,
    createdAt: assessment.createdAt,
    rulesVersionAtCreation: assessment.rulesVersion,
    company: assessment.companySnapshot,
    answers: assessment.answers,
    result: assess(assessment.companySnapshot, assessment.answers, todayInNorway()),
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

  let lookup;
  try {
    lookup = await lookupCompany(orgNumber);
  } catch (error: unknown) {
    console.error(error);
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

  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "Invalid assessment id" });
    return;
  }

  const assessment = await Assessment.findByPk(id);

  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  res.json(toResponse(assessment));
};
