import express from "express";
import {
  askAssistant,
  getAssistantStatus,
} from "../controllers/assistantController.js";
import { assistantLimit } from "../middlewares/rateLimits.js";

const router = express.Router();

router.get("/status", getAssistantStatus);
router.post("/ask", assistantLimit, askAssistant);

export default router;
