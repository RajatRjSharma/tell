import { expect, test } from "@playwright/test";

test.describe("policy events", () => {
  test("events panel renders on home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("events-panel")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("events-panel")).toContainText(
      "Typical sensitivity:",
    );
    await expect(page.getByTestId("events-panel")).toContainText(
      "not a prediction",
    );
  });
});
