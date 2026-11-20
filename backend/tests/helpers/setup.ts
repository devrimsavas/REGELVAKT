// Runs before every test file.
import { afterAll, beforeEach } from "vitest";
import { sequelize } from "../../src/config/database.js";
import { setLogSink } from "../../src/config/logger.js";
import { resetAssistant } from "../../src/services/assistantService.js";
import { clearBrregCache } from "../../src/services/brregService.js";
import { setLlmProvider } from "../../src/services/llm/llmProvider.js";

// The app's log lines are thrown away, so the test output stays readable.
// A test file that checks them collects them with useLogs().
setLogSink(() => {});

// Every test starts with empty tables, so tests cannot affect each other
beforeEach(async () => {
  await sequelize.truncate({ cascade: true });
  // Companies looked up in one test must not be remembered in the next
  clearBrregCache();
  // No language model unless a test sets one, and no answers remembered
  setLlmProvider(undefined);
  resetAssistant();
});

// Close the connection pool so Vitest can exit cleanly
afterAll(async () => {
  await sequelize.close();
});
