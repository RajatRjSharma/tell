import { expect, test } from "@playwright/test";

test.describe("event impact", () => {
  test("impact panel renders on home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("event-impact-panel")).toBeVisible({
      timeout: 20_000,
    });
  });
});
