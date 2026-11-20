import { test as base, expect, type Page } from "@playwright/test";
import { COUNTER_URL } from "../../playwright.config";

export { expect };
export type { Page };

// GoatCounter's script, replaced by one that keeps what it is asked to
// count in window.counted and sends it to the counter address like the
// real one, so the content security policy is tested too
async function fakeGoatCounter(page: Page) {
  await page.route("https://gc.zgo.at/count.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
        window.counted = [];
        window.goatcounter = window.goatcounter || {};
        window.goatcounter.count = function (vars) {
          window.counted.push(vars);
          fetch("${COUNTER_URL}?p=" + encodeURIComponent(vars.path), {
            method: "POST",
            keepalive: true,
          });
        };
      `,
    }),
  );
  await page.route(`${COUNTER_URL}**`, (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
}

// Every test uses this instead of Playwright's own: the counter is faked,
// and a page fails its test if the browser blocks anything under the
// content security policy, so a policy that is too strict is found.
// ("run" is the fixture's "use", renamed so React's lint rules leave it
// alone.)
export const test = base.extend({
  page: async ({ page }, run) => {
    await fakeGoatCounter(page);
    const blocked: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) {
        blocked.push(message.text());
      }
    });
    await run(page);
    expect(blocked, "blocked by the content security policy").toEqual([]);
  },
});
