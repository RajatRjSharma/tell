import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
  getSessionCookie,
  hasTurso,
  loginUser,
  logoutUser,
  pageApiGet,
  registerUser,
  waitForAuthNav,
} from "./helpers";

test.describe("page auth gate", () => {
  test("protects home and methodology when signed out", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");

    await page.goto("/methodology");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(page.url()).toContain("next=%2Fmethodology");
  });

  test("keeps login and register public", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");
    await page.goto("/register");
    await expect(page.getByTestId("auth-title")).toHaveText("Create account");
  });
});

test.describe("page auth gate (signed in)", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("returns to next path after login", async ({ page }) => {
    const email = `e2e.next.${Date.now()}@tell.test`;
    await registerUser(page, email);
    await logoutUser(page);

    await page.goto("/methodology");
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/methodology/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /How Tell reads the market/i,
    );
  });

  test("sends signed-in users away from login and register", async ({
    page,
  }) => {
    const email = `e2e.bounce.${Date.now()}@tell.test`;
    await registerUser(page, email);

    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);

    await page.goto("/register");
    await expect(page).toHaveURL("/");
  });

  test("session cookie unlocks product APIs", async ({ page }) => {
    const email = `e2e.api.${Date.now()}@tell.test`;
    await registerUser(page, email);
    await getSessionCookie(page);

    const outlook = await pageApiGet(page, "/api/outlook");
    expect(outlook.status).toBe(200);
    const assets = await pageApiGet(page, "/api/assets");
    expect(assets.status).toBe(200);

    await logoutUser(page);
    const blocked = await pageApiGet(page, "/api/outlook");
    expect(blocked.status).toBe(401);
  });

  test("login helper lands on dashboard", async ({ page }) => {
    const email = `e2e.loginhelper.${Date.now()}@tell.test`;
    await registerUser(page, email);
    await logoutUser(page);
    await loginUser(page, email);
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });
});
