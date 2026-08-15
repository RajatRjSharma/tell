import { expect, test, type Page } from "@playwright/test";

async function waitForAuthNav(page: Page) {
  await expect(page.getByTestId("auth-loading")).toBeHidden({
    timeout: 15_000,
  });
}

test.describe("home smoke", () => {
  test("shows brand and auth navigation when logged out", async ({ page }) => {
    await page.goto("/");
    await waitForAuthNav(page);

    await expect(page.getByTestId("home-heading")).toContainText(
      "Global activity",
    );
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-register")).toBeVisible();
  });

  test("navigates to login and register pages", async ({ page }) => {
    await page.goto("/");
    await waitForAuthNav(page);
    await page.getByTestId("nav-signin").click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");

    await page.getByTestId("auth-alt-link").click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId("auth-title")).toHaveText("Create account");
  });
});
