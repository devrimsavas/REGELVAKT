import express from "express";
import {
  getCompanyByOrgNumber,
  getQuestionsByOrgNumber,
} from "../controllers/companyController.js";

const router = express.Router();

router.get("/:orgNumber", getCompanyByOrgNumber);
router.get("/:orgNumber/questions", getQuestionsByOrgNumber);

export default router;
