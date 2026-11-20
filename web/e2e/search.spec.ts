import { expect, test } from "@playwright/test";
import { BANKRUPT, BRREG_DOWN, ENK, NUF, STRUCK_OFF } from "./helpers/flow";

test.describe("searching for a business", () => {
  test("checks the number before asking the register, and keeps what was typed", async ({ page }) => {
    await page.goto("/");
    const field = page.getByLabel("Organisasjonsnummer");
    const search = page.getByRole("button", { name: "Finn virksomheten" });

    await search.click();
    await expect(page.getByText("Skriv inn organisasjonsnummeret.")).toBeVisible();

    await field.fill("974 760 674");
    await search.click();
    await expect(page.getByText("Organisasjonsnummeret er ikke gyldig")).toBeVisible();
    await expect(field).toHaveValue("974 760 674");

    await field.fill("974 760 673");
    await search.click();
    await expect(page).toHaveURL(`/start/${ENK}`);
    await expect(page.getByRole("heading", { level: 1, name: "TESTFRISØR ENK" })).toBeVisible();
    await expect(page.getByText("Org.nr. 974 760 673")).toBeVisible();
  });

  test("says when the register does not know the business, or has struck it off", async ({ page }) => {
    await page.goto("/start/911111160");
    await expect(page.getByText("Det finnes ingen virksomhet med dette organisasjonsnummeret")).toBeVisible();

    await page.goto(`/start/${STRUCK_OFF}`);
    await expect(page.getByText("Virksomheten er slettet fra Enhetsregisteret.")).toBeVisible();
  });

  test("says when the register does not answer", async ({ page }) => {
    await page.goto(`/start/${BRREG_DOWN}`);
    await expect(page.getByText("Brønnøysundregistrene svarer ikke akkurat nå.")).toBeVisible();
  });

  test("explains that an organization form is not covered yet", async ({ page }) => {
    await page.goto(`/start/${NUF}`);
    await expect(
      page.getByText("Regelvakt gjelder foreløpig bare enkeltpersonforetak og aksjeselskap"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Se pliktene og fristene" })).toHaveCount(0);
  });

  test("shows that a business is bankrupt", async ({ page }) => {
    await page.goto(`/start/${BANKRUPT}`);
    await expect(page.getByText("Konkurs", { exact: true })).toBeVisible();
  });
});
