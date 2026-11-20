import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests use their own database and settings from .env.test,
// never the development database in .env. In CI they come from the workflow.
// Empty lines such as "SUBSCRIPTION_SECRET=" are left out, so they do not
// hide the defaults below
const testEnv = Object.fromEntries(
  Object.entries(
    config({ path: ".env.test", quiet: true }).parsed ?? {},
  ).filter(([, value]) => value !== ""),
);

// Settings every test run needs that are not secret; .env.test or the CI
// workflow may override them
const testDefaults = {
  SUBSCRIPTION_SECRET: "test-secret-that-is-at-least-32-characters",
  EMAIL_PROVIDER: "log",
  WEB_APP_URL: "http://web.test",
  // The crawler does not wait between requests to the fake sites
  CRAWL_DELAY_MS: "0",
  // No language model unless a test sets one
  AI_PROVIDER: "",
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
