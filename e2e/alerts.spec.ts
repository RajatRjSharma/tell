import { expect, test, type Page } from "@playwright/test";

const hasTurso =
  Boolean(process.env.TURSO_DATABASE_URL) &&
  Boolean(process.env.TURSO_AUTH_TOKEN) &&
  Boolean(process.env.JWT_SECRET);

async function waitForAuthNav(page: Page) {
  await expect(page.getByTestId("auth-loading")).toBeHidden({
    timeout: 15_000,
  });
}

async function registerUser(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-otp")).toBeVisible();
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("/");
  await waitForAuthNav(page);
  await expect(page.getByTestId("user-email")).toHaveText(email);
}

test.describe("alerts", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("create direction-change rule for watched symbol", async ({ page }) => {
    const email = `e2e.alert.${Date.now()}@tell.test`;
    const password = "Password123!";

    await registerUser(page, email, password);

    await page.getByTestId("asset-filter").selectOption("all");
    await page.getByTestId("watch-toggle-SPY").click();
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
    await page.getByTestId("alerts-create").click();

    await expect(page.locator('[data-testid^="alert-rule-"]')).toHaveCount(1, {
      timeout: 10_000,
    });
  });
});
