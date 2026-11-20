//router index.ts

import type { Request, Response } from "express";
import express from "express";
import { sequelize } from "../config/database.js";
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

// GET /api/health: whether the API can serve requests, for Docker's health
// check and an uptime monitor. Answers 503 when the database is down.
router.get("/health", async (req: Request, res: Response) => {
  // #swagger.tags = ["General"]
  // #swagger.summary = "Whether the API and its database are up"
  try {
    await sequelize.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error: unknown) {
    req.log.error({ err: error }, "Health check: the database is down");
    res.status(503).json({ status: "unavailable" });
  }
});

router.use("/companies", companiesRouter);
router.use("/assessments", assessmentsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/assistant", assistantRouter);

export default router;
