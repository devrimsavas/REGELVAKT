import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js's own rules (React, hooks, accessibility, performance). The API
// in backend/ uses Biome; the web app uses ESLint for these Next.js rules.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/theme/**",
  ]),
]);

export default eslintConfig;
