import { expect, test } from "@playwright/test";

test.describe("macro strip", () => {
  test("sparkline strip renders under the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("macro-strip")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("macro-strip")).toContainText(
      /monthly readings/,
    );
    await expect(page.getByTestId("macro-strip")).toContainText(
      /market sessions/,
    );
    await expect(page.getByTestId("macro-strip")).toContainText(
      /CPI index level|Inflation \(YoY\)|prior month|prior session/i,
    );
  });
});
