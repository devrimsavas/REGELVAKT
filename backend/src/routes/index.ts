//router index.ts

import express from "express";
import type {Request,Response} from "express";
import companiesRouter from "./companies.js";
import assessmentsRouter from "./assessments.js";
const router=express.Router();

router.get("/",(req:Request,res:Response)=> {
    // #swagger.tags = ["General"]
    res.json({
        message:"main api page "
    })
})

router.use("/companies", companiesRouter);
router.use("/assessments", assessmentsRouter);

export default router;
