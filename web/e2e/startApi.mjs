// Starts the real API for the end-to-end tests. It runs from backend/,
// where it finds its migrations, and its log (with the emails, since
// EMAIL_PROVIDER=log) is written to API_LOG for the tests to read.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../../backend");
const logFile = path.resolve(here, "..", process.env.API_LOG ?? "e2e/.output/api.log");

mkdirSync(path.dirname(logFile), { recursive: true });
const log = createWriteStream(logFile, { flags: "w" });

const api = spawn(process.execPath, ["dist/server.js"], {
  cwd: backend,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
api.stdout.pipe(log);
api.stderr.pipe(process.stderr);
api.stderr.pipe(log);

// Playwright stops this process when the tests are done; the API stops
// with it
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => api.kill(signal));
}
// When the API stops on its own (such as a wrong database password), its
// last log lines are shown, so the reason is not hidden in the file
api.on("exit", (code) => {
  if (code) {
    log.end(() => {
      const lines = readFileSync(logFile, "utf8").trim().split("\n").slice(-5);
      console.error(`The API stopped (exit code ${code}). Its last log lines:`);
      for (const line of lines) console.error(line.slice(0, 600));
      process.exit(code);
    });
  } else {
    process.exit(0);
  }
});
