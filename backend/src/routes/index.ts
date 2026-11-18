//router index.ts

import express from "express";
import type {Request,Response} from "express";
import companiesRouter from "./companies.js";
const router=express.Router();

router.get("/",(req:Request,res:Response)=> {
    res.json({
        message:"main api page "
    })
})

router.use("/companies", companiesRouter);

export default router;
