import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests use their own database and settings from .env.test,
// never the development database in .env. In CI they come from the workflow.
const testEnv = config({ path: ".env.test", quiet: true }).parsed ?? {};

// Settings every test run needs that are not secret; .env.test or the CI
// workflow may override them
const testDefaults = {
  SUBSCRIPTION_SECRET: "test-secret-that-is-at-least-32-characters",
  EMAIL_PROVIDER: "log",
  WEB_APP_URL: "http://web.test",
};

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { ...testDefaults, ...testEnv },
    globalSetup: ["tests/helpers/globalSetup.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    // All test files share one database, so they must not run at the same time
    fileParallelism: false,
  },
});
