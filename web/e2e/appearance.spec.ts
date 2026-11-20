import { expect, test } from "@playwright/test";

test.describe("language and appearance", () => {
  test("follow the browser, and a choice is remembered", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "nb");

    await page.getByRole("button", { name: "Change the language to English" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Which obligations and deadlines/ }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("button", { name: "Switch between light and dark appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");
  });

  test.describe("in English from the browser", () => {
    test.use({ locale: "en-GB" });

    test("the page is in English", async ({ page }) => {
      await page.goto("/start/974760673");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("button", { name: "See the obligations and deadlines" })).toBeVisible();
    });
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the menu is behind a button, and closes when a page is chosen", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Hovedmeny" })).toBeHidden();
      await page.getByRole("button", { name: "Meny" }).click();
      const menu = page.locator("#site-menu");
      await menu.getByRole("link", { name: "Kontakt" }).click();
      await expect(page).toHaveURL("/kontakt");
      await expect(menu).toBeHidden();
    });
  });
});
