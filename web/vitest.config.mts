import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the web app's own logic (src/lib, src/i18n, src/proxy.ts).
// The pages themselves are tested in a real browser with Playwright.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" refuses to load outside Next.js's server; the tests
      // are server code too
      "server-only": fileURLToPath(
        new URL("./tests/helpers/empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
