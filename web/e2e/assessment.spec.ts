import { expect, test } from "@playwright/test";
import { AS, createAssessment, ENK, QUESTIONS } from "./helpers/flow";

test.describe("the assessment", () => {
  test("lists what is missing and keeps the answers given", async ({ page }) => {
    await page.goto(`/start/${ENK}`);
    const twoMonths = page
      .getByRole("group", { name: QUESTIONS.vatTerm })
      .getByRole("radio", { name: "Annenhver måned" });
    await twoMonths.check();
    await page.getByRole("button", { name: "Se pliktene og fristene" }).click();

    await expect(page.getByText("Svar på alle spørsmålene for å gå videre:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Betaler du lønn/ })).toBeVisible();
    await expect(twoMonths).toBeChecked();
  });

  test("has a tab for each part, each with its own address and title", async ({ page }) => {
    const path = await createAssessment(page, AS, {
      vatTerm: "Annenhver måned",
      paysSalary: "Ja",
    });
    const tabs = page.getByRole("navigation", { name: "Sider for virksomheten" });

    await expect(page).toHaveTitle("Oversikt – TESTSELSKAP AS");
    for (const [tab, slug, heading] of [
      ["Plikter", "obligations", "Plikter"],
      ["Kalender", "calendar", "Året som kommer"],
      ["Påminnelser", "reminders", "Påminnelser på e-post"],
      ["Spør", "assistant", "Spør om TESTSELSKAP AS"],
      ["Svarene dine", "answers", "Svarene dine"],
    ] as const) {
      await tabs.getByRole("link", { name: tab }).click();
      await expect(page).toHaveURL(`${path}/${slug}`);
      await expect(tabs.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      await expect(page).toHaveTitle(`${tab} – TESTSELSKAP AS`);
    }
  });

  test("lists the next deadlines and links each to its obligation", async ({ page }) => {
    await createAssessment(page, AS, { vatTerm: "Annenhver måned", paysSalary: "Ja" });

    const rows = page.getByRole("table").getByRole("row");
    // A header row and six deadlines
    await expect(rows).toHaveCount(7);
    await rows.nth(1).getByRole("link").click();
    await expect(page).toHaveURL(/\/obligations#obligation-/);
    const hash = new URL(page.url()).hash;
    await expect(page.locator(hash)).toBeVisible();
  });

  test("works the obligations out again when the answers change", async ({ page }) => {
    const path = await createAssessment(page, AS, {
      vatTerm: "Annenhver måned",
      paysSalary: "Ja",
    });
    await page.goto(`${path}/obligations`);
    await expect(page.getByRole("heading", { level: 3, name: "A-melding", exact: true })).toBeVisible();

    await page.goto(`${path}/answers`);
    await page
      .getByRole("group", { name: QUESTIONS.paysSalary })
      .getByRole("radio", { name: "Nei" })
      .check();
    await page.getByRole("button", { name: "Lagre svarene" }).click();
    await expect(page).toHaveURL(`${path}?updated=1`);
    await expect(page.getByText("Svarene er lagret")).toBeVisible();

    await page.goto(`${path}/obligations`);
    await expect(page.getByRole("heading", { level: 3, name: "A-melding", exact: true })).toHaveCount(0);
  });

  test("gives a calendar to subscribe to, and one to download", async ({ page, request }) => {
    const path = await createAssessment(page, ENK, {
      vatTerm: "Annenhver måned",
      paysSalary: "Nei",
      expectsProfit: "Ja",
    });
    await page.goto(`${path}/calendar`);
    const address = await page.getByLabel("Kalenderadresse").inputValue();
    expect(address).toMatch(/\/calendar\/[0-9a-f-]{36}\.ics\?lang=nb$/);

    const calendar = await request.get(address);
    expect(calendar.headers()["content-type"]).toContain("text/calendar");
    expect(await calendar.text()).toContain("BEGIN:VEVENT");

    const download = await request.get(
      (await page.getByRole("link", { name: "Last ned som fil (.ics)" }).getAttribute("href")) ?? "",
    );
    expect(download.headers()["content-disposition"]).toMatch(/^attachment;/);
  });

  test("deletes the page with everything on it", async ({ page, request }) => {
    const path = await createAssessment(page, ENK, {
      vatTerm: "Annenhver måned",
      paysSalary: "Nei",
      expectsProfit: "Ja",
    });
    const id = path.split("/").pop();

    await page.goto(`${path}/answers`);
    await page.getByRole("link", { name: "Slett siden" }).click();
    await page.getByRole("button", { name: "Slett for godt" }).click();
    await expect(page).toHaveURL("/?deleted=1");
    await expect(page.getByText("Siden er slettet")).toBeVisible();

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Fant ikke siden" })).toBeVisible();
    expect((await request.get(`/calendar/${id}.ics`)).status()).toBe(404);
  });
});
