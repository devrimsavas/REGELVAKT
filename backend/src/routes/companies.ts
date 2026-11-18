import express from "express";
import { getCompanyByOrgNumber } from "../controllers/companyController.js";

const router = express.Router();

router.get("/:orgNumber", getCompanyByOrgNumber);

export default router;
