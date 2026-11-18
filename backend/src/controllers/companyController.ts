import type { Request, Response } from "express";
import { lookupCompany } from "../services/brregService.js";
import { isValidOrgNumber } from "../utils/orgNumber.js";
import { toCompanyFacts } from "../rules/engine.js";
import { questionsFor } from "../rules/answers.js";
import { toQuestionView } from "../rules/views.js";

// GET /api/companies/:orgNumber
export const getCompanyByOrgNumber = async (
  req: Request<{ orgNumber: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Companies"]
  // #swagger.summary = "Company data from Brønnøysundregistrene"
  /* #swagger.parameters['orgNumber'] = { description: "9-digit organization number", example: "974760673" } */
  const { orgNumber } = req.params;

  if (!isValidOrgNumber(orgNumber)) {
    res.status(400).json({ error: "Invalid organization number" });
    return;
  }

  try {
    const result = await lookupCompany(orgNumber);

    switch (result.status) {
      case "active":
        res.json(result.company);
        return;
      case "deleted":
        res.status(410).json({
          error: "Company has been struck off the register",
          deletedDate: result.deletedDate,
        });
        return;
      case "notFound":
        res.status(404).json({ error: "Company not found" });
        return;
    }
  } catch (error: unknown) {
    console.error(error);
    res.status(502).json({ error: "Could not reach the Brreg API" });
  }
};

// GET /api/companies/:orgNumber/questions
export const getQuestionsByOrgNumber = async (
  req: Request<{ orgNumber: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Companies"]
  // #swagger.summary = "The questions this company is asked before an assessment"
  /* #swagger.parameters['orgNumber'] = { description: "9-digit organization number", example: "974760673" } */
  const { orgNumber } = req.params;

  if (!isValidOrgNumber(orgNumber)) {
    res.status(400).json({ error: "Invalid organization number" });
    return;
  }

  try {
    const result = await lookupCompany(orgNumber);

    if (result.status === "deleted") {
      res.status(410).json({ error: "Company has been struck off the register" });
      return;
    }
    if (result.status === "notFound") {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const facts = toCompanyFacts(result.company);

    if (facts === null) {
      res.json({
        supported: false,
        organizationForm: result.company.organizationForm,
        questions: [],
      });
      return;
    }

    res.json({
      supported: true,
      organizationForm: facts.organizationForm,
      questions: questionsFor(facts).map(toQuestionView),
    });
  } catch (error: unknown) {
    console.error(error);
    res.status(502).json({ error: "Could not reach the Brreg API" });
  }
};
