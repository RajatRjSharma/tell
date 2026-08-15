import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
  e2eUsername,
  hasTurso,
  logoutUser,
  registerUser,
  waitForAuthNav,
} from "./helpers";

test.describe("auth validation", () => {
  test("shows error for invalid credentials format on login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill("not-an-email");
    await page.getByTestId("auth-password").fill("password1");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /username must be|valid email|email or username/i,
    );
  });

  test("login page links to API docs", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "API docs" }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.locator(".swagger-ui")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("auth flow", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");
  test.describe.configure({ mode: "serial" });

  test("register, stay signed in, then log out", async ({ page }) => {
    const email = `e2e.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await expect(page.getByTestId("logout-button")).toBeVisible();

    await logoutUser(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects duplicate registration", async ({ page }) => {
    const email = `e2e.dup.${Date.now()}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/register");
    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /already exists/i,
    );
  });

  test("login works after register", async ({ page }) => {
    const email = `e2e.login.${Date.now()}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(email);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
  });

  test("login works with username", async ({ page }) => {
    const email = `e2e.userlogin.${Date.now()}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(username);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
  });

  test("login fails with wrong password", async ({ page }) => {
    const email = `e2e.wrong.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(email);
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email, username, or password/i,
    );
  });
});
