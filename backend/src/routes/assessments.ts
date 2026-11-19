import express from "express";
import {
  createAssessment,
  deleteAssessment,
  getAssessmentById,
} from "../controllers/assessmentController.js";
import { createSubscription } from "../controllers/subscriptionController.js";
import {
  brregLimit,
  subscribePerAddressLimit,
  subscribePerEmailLimit,
} from "../middlewares/rateLimits.js";

const router = express.Router();

// Creating an assessment looks the company up in Brreg; reading one does not
router.post("/", brregLimit, createAssessment);
router.get("/:id", getAssessmentById);
router.delete("/:id", deleteAssessment);

// Each new subscription sends an email
router.post(
  "/:id/subscriptions",
  subscribePerAddressLimit,
  subscribePerEmailLimit,
  createSubscription,
);

export default router;
