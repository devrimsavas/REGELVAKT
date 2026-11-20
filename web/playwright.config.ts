import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: the web app and the real API, against stand-ins for
// Brønnøysundregistrene and the language model, so every run sees the same
// companies and answers. Emails are written to the API's log, which the
// reminder tests read the links from.
//
// Needs PostgreSQL with an empty database (E2E_DB_NAME, by default
// regelvakt_e2e) and the API built (npm run build in backend/).
const WEB_PORT = 3101;
const API_PORT = 3100;

// The database server's address, user and password are those of the API's
// own settings (backend/.env), so nothing has to be given again; only the
// database is another one. E2E_DB_* settings win, and without
// backend/.env (as in CI) the defaults are used.
function apiDatabaseSettings(): Record<string, string | undefined> {
  const file = path.join(__dirname, "../backend/.env");
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
}
const api = apiDatabaseSettings();
const DB = {
  DB_HOST: process.env.E2E_DB_HOST ?? api.DB_HOST ?? "localhost",
  DB_PORT: process.env.E2E_DB_PORT ?? api.DB_PORT ?? "5432",
  DB_NAME: process.env.E2E_DB_NAME ?? "regelvakt_e2e",
  DB_USER: process.env.E2E_DB_USER ?? api.DB_USER ?? "postgres",
  DB_PASSWORD: process.env.E2E_DB_PASSWORD ?? api.DB_PASSWORD ?? "postgres",
};
export const API_LOG = "e2e/.output/api.log";
export const E2E_DB = DB;

// The page view counter the web app is started with. Made up: the tests
// answer for GoatCounter (e2e/helpers/test.ts).
export const COUNTER_URL = "https://e2e.goatcounter.test/count";

export default defineConfig({
  testDir: "./e2e",
  // The tests share one database and one API; one at a time keeps the
  // reminder emails in the log in order
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: "nb-NO",
    trace: "retain-on-failure",
    // E2E_BROWSER_PATH: a Chrome already installed, instead of the one
    // "npx playwright install chromium" downloads
    ...(process.env.E2E_BROWSER_PATH
      ? { launchOptions: { executablePath: process.env.E2E_BROWSER_PATH } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fakes/brreg.mjs",
      url: "http://127.0.0.1:4010/enheter/974760673",
      env: { PORT: "4010" },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node e2e/fakes/ollama.mjs",
      port: 4011,
      env: { PORT: "4011" },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Runs from backend/, where the migrations are found. Every setting
      // that matters is given here, so the rest of backend/.env (such as
      // the email provider) has no effect.
      command: `node e2e/startApi.mjs`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: {
        ...DB,
        PORT: String(API_PORT),
        BRREG_API_URL: "http://127.0.0.1:4010",
        AI_PROVIDER: "ollama",
        OLLAMA_HOST: "http://127.0.0.1:4011",
        OLLAMA_MODEL: "fake",
        EMAIL_PROVIDER: "log",
        WEB_APP_URL: `http://127.0.0.1:${WEB_PORT}`,
        SUBSCRIPTION_SECRET: "e2e-secret-that-is-at-least-32-characters",
        KNOWLEDGE_UPDATES: "off",
        LOG_LEVEL: "info",
        LOG_FORMAT: "json",
        // Every request comes from the same address in the tests
        REQUESTS_PER_ADDRESS: "100000",
        BRREG_REQUESTS_PER_ADDRESS: "100000",
        SUBSCRIPTIONS_PER_ADDRESS: "100000",
        SUBSCRIPTIONS_PER_EMAIL: "100000",
        ASSISTANT_QUESTIONS_PER_ADDRESS: "100000",
        NO_PROXY: "127.0.0.1,localhost",
        API_LOG,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build && npx next start -p ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}/health`,
      env: {
        API_URL: `http://127.0.0.1:${API_PORT}`,
        NEXT_TELEMETRY_DISABLED: "1",
        // A made-up counter; the tests answer for GoatCounter (helpers/test.ts)
        GOATCOUNTER_URL: COUNTER_URL,
      },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
