//router index.ts

import type { Request, Response } from "express";
import express from "express";
import assessmentsRouter from "./assessments.js";
import companiesRouter from "./companies.js";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  // #swagger.tags = ["General"]
  res.json({
    message: "main api page ",
  });
});

router.use("/companies", companiesRouter);
router.use("/assessments", assessmentsRouter);

export default router;
