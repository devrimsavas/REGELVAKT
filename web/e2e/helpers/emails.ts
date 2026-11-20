import { readFileSync } from "node:fs";
import path from "node:path";
import { API_LOG } from "../../playwright.config";

// (Playwright loads the tests as CommonJS, so __dirname is there)
const logFile = path.resolve(__dirname, "../..", API_LOG);

// How many emails the API has written to its log so far
export function emailCount(): number {
  return (readFileSync(logFile, "utf8").match(/---- Email \(EMAIL_PROVIDER=log/g) ?? []).length;
}

// The last link of this kind in the emails in the API's log, waiting for
// it a moment since the log is written as the email is sent
export async function lastLink(
  kind: "confirm" | "manage",
  after = 0,
): Promise<string> {
  const pattern =
    kind === "confirm"
      ? /https?:\/\/[^\s"]+\/reminders\/confirm\?token=[A-Za-z0-9_.%-]+/g
      : /https?:\/\/[^\s"]+\/reminders\/manage\?token=[A-Za-z0-9_.%-]+/g;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (emailCount() > after) {
      const links = readFileSync(logFile, "utf8").match(pattern);
      const link = links?.at(-1);
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ${kind} link in the API's log`);
}
