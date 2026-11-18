import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Tests use their own database and settings from .env.test,
// never the development database in .env. In CI they come from the workflow.
const testEnv = config({ path: ".env.test", quiet: true }).parsed ?? {};

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: testEnv,
    globalSetup: ["tests/helpers/globalSetup.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    // All test files share one database, so they must not run at the same time
    fileParallelism: false,
  },
});
