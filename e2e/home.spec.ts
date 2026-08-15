import { expect, test } from "@playwright/test";

test.describe("home smoke", () => {
  test("redirects logged-out visitors to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");
  });

  test("login and register pages are reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");

    await page.getByTestId("auth-alt-link").click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId("auth-title")).toHaveText("Create account");
  });
});
