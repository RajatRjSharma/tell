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

test.describe("watchlist", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("star a symbol, filter watchlist, then remove", async ({ page }) => {
    const email = `e2e.watch.${Date.now()}@tell.test`;
    const password = "TellSecure99!";

    await registerUser(page, email, password);

    await page.getByTestId("asset-filter").selectOption("all");
    const star = page.getByTestId("watch-toggle-SPY");
    await expect(star).toBeVisible();
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("asset-filter").selectOption("watchlist");
    await expect(page.getByTestId("outlook-row-SPY")).toBeVisible();
    await expect(page.getByTestId("outlook-empty")).toHaveCount(0);

    await page.getByTestId("watch-toggle-SPY").click();
    await expect(page.getByTestId("outlook-empty")).toBeVisible();
  });
});
