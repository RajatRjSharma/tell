import { expect, test } from "@playwright/test";

test.describe("methodology", () => {
  test("page renders disclaimer and is linked from home", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-methodology").click();
    await expect(page).toHaveURL(/\/methodology/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /How Tell reads the market/i,
    );
    await expect(page.getByTestId("methodology-disclaimer")).toBeVisible();
  });

  test("economic terms explain themselves on demand", async ({ page }) => {
    await page.goto("/methodology");

    const cpiHelp = page.getByRole("button", {
      name: "What does CPI mean?",
    });
    await expect(cpiHelp).toBeVisible();
    await cpiHelp.click();
    await expect(page.getByRole("tooltip")).toContainText(
      "Consumer Price Index",
    );

    await expect(
      page.getByRole("button", { name: "What does Yield curve mean?" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "What does VIX mean?" }).first(),
    ).toBeVisible();
  });
});
