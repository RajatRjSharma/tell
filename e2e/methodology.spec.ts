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
});
