import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "./helpers/test";
import { AS, createAssessment } from "./helpers/flow";

// WCAG 2.2 level A and AA, the level Norwegian rules (uu-forskriften) ask
// public-facing web solutions for
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const problems = results.violations.map(
    (violation) =>
      `${where}: ${violation.id} (${violation.impact}) – ${violation.help}\n  ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("\n  ")}`,
  );
  expect(problems, problems.join("\n")).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility in ${scheme} mode`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([
        { name: "color-scheme", value: scheme, url: baseURL ?? "" },
      ]);
    });

    test("the pages anyone can open", async ({ page }) => {
      for (const path of ["/", "/assistent", "/om", "/kontakt", "/personvern", "/start/918794727"]) {
        await page.goto(path);
        await expectNoViolations(page, path);
      }
    });

    test("the pages for a business", async ({ page }) => {
      const path = await createAssessment(page, AS, {
        vatTerm: "Annenhver måned",
        paysSalary: "Ja",
      });
      for (const tab of ["", "/obligations", "/calendar", "/reminders", "/assistant", "/answers", "/delete"]) {
        await page.goto(`${path}${tab}`);
        await expectNoViolations(page, `${path}${tab}`);
      }
    });

    test("a form with its error messages", async ({ page }) => {
      await page.goto("/start/918794727");
      await page.getByRole("button", { name: "Se pliktene og fristene" }).click();
      await expect(page.getByText("Svar på alle spørsmålene")).toBeVisible();
      await expectNoViolations(page, "questions with errors");
    });
  });
}
