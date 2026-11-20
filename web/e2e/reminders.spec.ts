import { expect, type Page, test } from "./helpers/test";
import { emailCount, lastLink } from "./helpers/emails";
import { createAssessment, ENK } from "./helpers/flow";

// The reminder form ignores forms sent within two seconds of the page
// being shown (a bot check), so a test that orders reminders waits first
async function orderReminders(page: Page, email: string, wait = 2500) {
  await page.waitForTimeout(wait);
  await page.getByLabel("E-postadresse").fill(email);
  await page.getByRole("checkbox", { name: /Jeg vil få påminnelser/ }).check();
  await page.getByRole("button", { name: "Bestill påminnelser" }).click();
  await expect(page.getByText("Sjekk e-posten din")).toBeVisible();
}

test.describe("reminders by email", () => {
  test("are ordered, confirmed with a button, changed and stopped", async ({ page }) => {
    const path = await createAssessment(page, ENK, {
      vatTerm: "Annenhver måned",
      paysSalary: "Nei",
      expectsProfit: "Ja",
    });
    await page.goto(`${path}/reminders`);

    // Nothing filled in: every problem is shown, and the days stay ticked
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Bestill påminnelser" }).click();
    await expect(page.getByText("Skriv inn en gyldig e-postadresse.")).toBeVisible();
    await expect(page.getByText("Kryss av for at du vil få påminnelser.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "14 dager før" })).toBeChecked();

    const before = emailCount();
    await orderReminders(page, `e2e-${Date.now()}@example.com`, 0);

    // Opening the link does not start the reminders; the button does
    await page.goto(await lastLink("confirm", before));
    await expect(page.getByRole("heading", { level: 1, name: "Bekreft påminnelsene" })).toBeVisible();
    await page.getByRole("button", { name: "Start påminnelsene" }).click();
    await expect(page).toHaveURL(/\/reminders\/manage\?token=.+&confirmed=1$/);
    await expect(page.getByText("Påminnelsene er startet")).toBeVisible();

    await page.getByRole("checkbox", { name: "30 dager før" }).check();
    await page.getByRole("radio", { name: "English" }).check();
    await page.getByRole("button", { name: "Lagre" }).click();
    await expect(page.getByText("Endringene er lagret.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "30 dager før" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "English" })).toBeChecked();

    await page.getByRole("button", { name: "Stopp påminnelsene" }).click();
    await expect(page).toHaveURL("/reminders/stopped");
    await expect(page.getByRole("heading", { level: 1, name: "Påminnelsene er stoppet" })).toBeVisible();
  });

  test("stop at once from the mail program's one-click address", async ({ page, request }) => {
    const path = await createAssessment(page, ENK, {
      vatTerm: "Annenhver måned",
      paysSalary: "Nei",
      expectsProfit: "Ja",
    });
    await page.goto(`${path}/reminders`);
    const before = emailCount();
    await orderReminders(page, `e2e-oneclick-${Date.now()}@example.com`);
    await page.goto(await lastLink("confirm", before));
    await page.getByRole("button", { name: "Start påminnelsene" }).click();
    await expect(page).toHaveURL(/confirmed=1$/);
    const token = new URL(page.url()).searchParams.get("token") ?? "";

    // Opened in a browser: only the page to stop them, nothing stopped
    await page.goto(`/reminders/unsubscribe/one-click?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { level: 2, name: "Stopp påminnelsene" })).toBeVisible();

    const response = await request.post(
      `/reminders/unsubscribe/one-click?token=${encodeURIComponent(token)}`,
      { form: { "List-Unsubscribe": "One-Click" } },
    );
    expect(response.status()).toBe(200);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Lenken virker ikke" })).toBeVisible();
  });

  test("are not sent for a form a bot sent at once", async ({ page }) => {
    const path = await createAssessment(page, ENK, {
      vatTerm: "Annenhver måned",
      paysSalary: "Nei",
      expectsProfit: "Ja",
    });
    await page.goto(`${path}/reminders`);
    const before = emailCount();
    // The same answer as for a person, so the bot learns nothing
    await orderReminders(page, `e2e-bot-${Date.now()}@example.com`, 0);
    await page.waitForTimeout(1000);
    expect(emailCount()).toBe(before);
  });

  test("cannot be ordered for a bankrupt business", async ({ page }) => {
    await page.goto("/start/911111136");
    // A company not in the VAT register is asked about its sales
    await page.getByRole("group", { name: /Regner du med å selge/ }).getByRole("radio", { name: "Nei" }).check();
    await page.getByRole("group", { name: /Betaler du lønn/ }).getByRole("radio", { name: "Nei" }).check();
    await page.getByRole("button", { name: "Se pliktene og fristene" }).click();
    await page.waitForURL(/\/assessments\/[0-9a-f-]{36}$/);
    await page.goto(`${new URL(page.url()).pathname}/reminders`);
    await expect(page.getByText("Påminnelser kan ikke bestilles for en virksomhet som er konkurs")).toBeVisible();
    await expect(page.getByLabel("E-postadresse")).toHaveCount(0);
  });
});
