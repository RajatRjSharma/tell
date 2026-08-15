import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("alerts", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("create direction-change rule for watched symbol", async ({ page }) => {
    const email = `e2e.alert.${Date.now()}@tell.test`;

    await registerUser(page, email);

    await page.getByTestId("asset-filter").selectOption("all");

    const watchResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/watchlist") &&
        res.request().method() === "POST" &&
        res.ok(),
    );
    await page.getByTestId("watch-toggle-SPY").click();
    await watchResponse;
    await expect(page.getByTestId("watch-toggle-SPY")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const panel = page.getByTestId("alerts-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("alerts-create-form")).toBeVisible();

    await page.getByTestId("alerts-symbol").selectOption("SPY");
    await page.getByTestId("alerts-horizon").selectOption("1d");
    await page.getByTestId("alerts-rule-type").selectOption("direction_change");

    const createResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/alerts") &&
        res.request().method() === "POST" &&
        res.status() === 201,
    );
    await page.getByTestId("alerts-create").click();
    await createResponse;

    await expect(page.locator('[data-testid^="alert-rule-"]')).toHaveCount(1, {
      timeout: 10_000,
    });
  });
});
