import { expect, test } from "@playwright/test";

test.describe("macro strip", () => {
  test("sparkline strip renders under the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("macro-strip")).toBeVisible({
      timeout: 20_000,
    });
  });
});
