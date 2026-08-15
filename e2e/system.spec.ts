import { expect, test } from "@playwright/test";

test.describe("system status", () => {
  test("renders health UI from the System nav link", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-system").click();
    await expect(page).toHaveURL(/\/system/);
    await expect(page.getByTestId("system-page")).toBeVisible();
    await expect(page.getByTestId("system-overall-status")).toBeVisible();
    await expect(page.getByTestId("system-check-app")).toBeVisible();
    await expect(page.getByTestId("system-check-config")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /System status/i,
    );
    await expect(page.getByRole("link", { name: /Raw JSON/i })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });
});
