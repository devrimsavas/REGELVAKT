// Generates swagger_output.json from the routes and the #swagger comments
// in the controllers. Run with `npm run swagger` after building.

import path from "node:path";
import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "Regelvakt API",
    description:
      "Shows small Norwegian businesses which official obligations apply to them, with deadlines and sources.",
    version: "1.0.0",
  },
  servers: [{ url: "/" }],
  tags: [
    {
      name: "Companies",
      description: "Company lookup and the questions for an assessment",
    },
    {
      name: "Assessments",
      description: "Obligations, deadlines and warnings for a company",
    },
    { name: "General", description: "API status" },
  ],
};

const outputFile = path.join(process.cwd(), "swagger_output.json");
const endpointsFiles = ["./dist/app.js"];

swaggerAutogen({ openapi: "3.0.0" })(outputFile, endpointsFiles, doc);
