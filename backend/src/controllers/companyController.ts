import type { Request, Response } from "express";
import { lookupCompany } from "../services/brregService.js";
import { isValidOrgNumber } from "../utils/orgNumber.js";

// GET /api/companies/:orgNumber
export const getCompanyByOrgNumber = async (
  req: Request<{ orgNumber: string }>,
  res: Response,
) => {
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
