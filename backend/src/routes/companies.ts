import express from "express";
import {
  getCompanyByOrgNumber,
  getQuestionsByOrgNumber,
} from "../controllers/companyController.js";
import { brregLimit } from "../middlewares/rateLimits.js";

const router = express.Router();

// Both routes look the company up in Brreg
router.get("/:orgNumber", brregLimit, getCompanyByOrgNumber);
router.get("/:orgNumber/questions", brregLimit, getQuestionsByOrgNumber);

export default router;
