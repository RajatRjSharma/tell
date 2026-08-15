import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
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
    await page.getByTestId("auth-email").fill("not-an-email");
    await page.getByTestId("auth-password").fill("short");
    await page.getByTestId("auth-submit").click();

    const emailInput = page.getByTestId("auth-email");
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );

    if (validationMessage) {
      expect(validationMessage.length).toBeGreaterThan(0);
      return;
    }

    await expect(page.getByTestId("auth-error")).toBeVisible();
  });

  test("exposes public auth config and protects product APIs", async ({
    request,
  }) => {
    const config = await request.get("/api/auth/config");
    expect(config.ok()).toBeTruthy();
    const body = (await config.json()) as {
      registrationEnabled: boolean;
      emailOtpEnabled: boolean;
    };
    expect(typeof body.registrationEnabled).toBe("boolean");
    expect(typeof body.emailOtpEnabled).toBe("boolean");

    const outlook = await request.get("/api/outlook");
    expect(outlook.status()).toBe(401);
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
    await expect(page.getByTestId("nav-register")).toBeVisible();
  });

  test("rejects duplicate registration", async ({ page }) => {
    const email = `e2e.dup.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await logoutUser(page);

    await page.goto("/register");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /already exists/i,
    );
  });

  test("login works after register", async ({ page }) => {
    const email = `e2e.login.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);
    await expect(page.getByTestId("user-email")).toHaveText(email);
  });

  test("login fails with wrong password", async ({ page }) => {
    const email = `e2e.wrong.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email or password/i,
    );
  });
});
