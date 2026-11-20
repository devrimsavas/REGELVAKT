import { expect, type Page } from "@playwright/test";

// The fictional companies of e2e/fakes/brreg.mjs
export const ENK = "974760673";
export const AS = "918794727";
export const NUF = "911111128";
export const BANKRUPT = "911111136";
export const STRUCK_OFF = "911111144";
export const BRREG_DOWN = "911111152";

export const QUESTIONS = {
  vatTerm: /Hvor ofte leverer du mva-melding/,
  paysSalary: /Betaler du lønn/,
  expectsProfit: /Regner du med overskudd/,
} as const;

// Answers the questions of a company's start page and goes to its
// assessment. Each answer is the label of the radio button to choose.
export async function createAssessment(
  page: Page,
  orgNumber: string,
  answers: Partial<Record<keyof typeof QUESTIONS, string>>,
): Promise<string> {
  await page.goto(`/start/${orgNumber}`);
  for (const [question, label] of Object.entries(answers)) {
    await page
      .getByRole("group", { name: QUESTIONS[question as keyof typeof QUESTIONS] })
      .getByRole("radio", { name: label, exact: true })
      .check();
  }
  await page.getByRole("button", { name: "Se pliktene og fristene" }).click();
  await page.waitForURL(/\/assessments\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: "De neste fristene" })).toBeVisible();
  return new URL(page.url()).pathname;
}
