import express from "express";
import {
  createAssessment,
  getAssessmentById,
} from "../controllers/assessmentController.js";

const router = express.Router();

router.post("/", createAssessment);
router.get("/:id", getAssessmentById);

export default router;
