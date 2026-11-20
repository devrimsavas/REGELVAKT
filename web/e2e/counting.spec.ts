import { AS, createAssessment } from "./helpers/flow";
import { expect, type Page, test } from "./helpers/test";

declare global {
  interface Window {
    counted?: { path: string; title: string }[];
  }
}

async function counted(page: Page): Promise<string[]> {
  return page.evaluate(() => (window.counted ?? []).map((vars) => vars.path));
}

test.describe("counting page views", () => {
  test("counts each page the user opens, without the business or the page's key", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => counted(page)).toEqual(["/"]);

    const path = await createAssessment(page, AS, {
      vatTerm: "Annenhver måned",
      paysSalary: "Ja",
    });
    await expect.poll(() => counted(page)).toContain("/assessments/:id");

    await page
      .getByRole("navigation", { name: "Sider for virksomheten" })
      .getByRole("link", { name: "Kalender" }).click();
    await expect.poll(() => counted(page)).toContain("/assessments/:id/calendar");

    const paths = await counted(page);
    expect(paths).toContain("/start/:org");
    const id = path.split("/").pop() ?? "";
    expect(paths.join(" ")).not.toContain(id);
    expect(paths.join(" ")).not.toContain(AS);
    // The title would name the business; it is the path too
    const titles = await page.evaluate(() => (window.counted ?? []).map((vars) => vars.title));
    expect(titles).toEqual(paths);
  });

  test("tells about the counting on the privacy page", async ({ page }) => {
    await page.goto("/personvern");
    await expect(page.getByRole("heading", { level: 2, name: "Besøkstelling" })).toBeVisible();
  });
});
