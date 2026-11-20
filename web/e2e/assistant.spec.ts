import { expect, test } from "./helpers/test";
import { seedKnowledgeBase } from "./helpers/db";
import { AS, createAssessment } from "./helpers/flow";

test.beforeAll(async () => {
  await seedKnowledgeBase();
});

test.describe("the assistant", () => {
  test("answers with numbered sources, and says which it used", async ({ page }) => {
    await page.goto("/assistent");
    await page.getByRole("button", { name: "Spør", exact: true }).click();
    await expect(page.getByText("Skriv et spørsmål.")).toBeVisible();

    const field = page.getByLabel("Spørsmålet ditt");
    await field.fill("Når må jeg levere mva-meldingen?");
    await field.press("Enter");

    await expect(page.getByText("Du spurte")).toBeVisible();
    await expect(field).toHaveValue("");
    const answer = page.locator("li", { hasText: "Du spurte" });
    // Regelvakt's rules are always source 1
    await expect(answer.getByText("Regelvakts egne regler, kontrollert mot de offisielle sidene")).toBeVisible();
    await expect(answer.getByText("Brukt i svaret")).toHaveCount(2);
    // [9] was not a source: it is removed from the answer
    await expect(answer.getByText("[9]")).toHaveCount(0);

    await answer.getByRole("link", { name: "[2]" }).first().click();
    expect(new URL(page.url()).hash).toMatch(/-source-2$/);
  });

  test("says when the language model's quota is used up, and gives the sources", async ({ page }) => {
    await page.goto("/assistent");
    const field = page.getByLabel("Spørsmålet ditt");
    // The stand-in model has no quota left for questions about "kvote"
    await field.fill("Når må mva-meldingen leveres? (kvote)");
    await field.press("Enter");

    const answer = page.locator("li", { hasText: "Du spurte" });
    await expect(answer.getByText("Assistenten har brukt opp dagens spørsmål til språkmodellen.")).toBeVisible();
    // The deadlines come from the rules, not only from the excerpts found
    await expect(answer.getByRole("heading", { name: "Fristene i Regelvakts regler" })).toBeVisible();
    await expect(answer.getByRole("listitem").filter({ hasText: "Mva-melding:" })).toContainText("januar–februar innen 10. april");
    await expect(answer.getByRole("heading", { name: "Kilder" })).toBeVisible();
    await expect(answer.getByText("Brukt i svaret")).toHaveCount(0);
  });

  test("answers for the business with its own next deadline", async ({ page }) => {
    const path = await createAssessment(page, AS, {
      vatTerm: "Annenhver måned",
      paysSalary: "Ja",
    });
    const firstDeadline = (
      await page.getByRole("table").getByRole("row").nth(1).getByRole("cell").first().locator("time").innerText()
    )
      // "Mandag 7. desember 2026" -> "7. desember 2026"
      .replace(/^\S+\s/, "");

    await page.goto(`${path}/assistant`);
    await page.getByRole("button", { name: "Hva er neste frist, og hva må jeg gjøre?" }).click();
    await expect(page.getByText("Du spurte")).toBeVisible();
    // The stand-in model repeats the first deadline of the rules it was
    // given: the business's own, the same as on the overview
    await expect(page.getByText(`Neste frist er ${firstDeadline}`)).toBeVisible();
  });
});
