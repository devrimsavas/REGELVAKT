//router index.ts

import type { Request, Response } from "express";
import express from "express";
import assessmentsRouter from "./assessments.js";
import assistantRouter from "./assistant.js";
import companiesRouter from "./companies.js";
import subscriptionsRouter from "./subscriptions.js";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  // #swagger.tags = ["General"]
  res.json({
    message: "main api page ",
  });
});

router.use("/companies", companiesRouter);
router.use("/assessments", assessmentsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/assistant", assistantRouter);

export default router;
