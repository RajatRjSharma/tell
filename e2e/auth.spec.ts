import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
  e2eUsername,
  hasTurso,
  loginUser,
  logoutUser,
  registerUser,
  requestRegisterOtp,
  waitForAuthNav,
} from "./helpers";

test.describe("auth UI", () => {
  test("login form uses a single email-or-username field", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");
    await expect(page.getByTestId("auth-identifier")).toBeVisible();
    await expect(page.getByTestId("auth-password")).toBeVisible();
    await expect(page.getByTestId("auth-username")).toHaveCount(0);
    await expect(page.getByTestId("auth-email")).toHaveCount(0);
    await expect(page.getByTestId("auth-confirm-password")).toHaveCount(0);
  });

  test("register step one asks for username and email only", async ({
    page,
  }) => {
    await page.goto("/register");
    await expect(page.getByTestId("auth-title")).toHaveText("Create account");
    await expect(page.getByTestId("auth-username")).toBeVisible();
    await expect(page.getByTestId("auth-email")).toBeVisible();
    await expect(page.getByTestId("auth-identifier")).toHaveCount(0);
    await expect(page.getByTestId("auth-password")).toHaveCount(0);
    await expect(page.getByTestId("auth-confirm-password")).toHaveCount(0);
  });

  test("login and register pages link to each other", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("link", { name: /Need an account\? Register/i })
      .click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByTestId("auth-title")).toHaveText("Create account");

    await page
      .getByRole("link", { name: /Already have an account\? Sign in/i })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("auth-title")).toHaveText("Sign in");
  });

  test("login page links to API docs", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "API docs" }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.locator(".swagger-ui")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("auth validation", () => {
  test("rejects invalid username-shaped login identifiers", async ({
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

  test("rejects malformed email login identifiers", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill("bad@domain");
    await page.getByTestId("auth-password").fill("password1");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(/valid email/i);
  });

  test("rejects unknown accounts without leaking which field failed", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill("nobody_exists_zz");
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email, username, or password/i,
    );
  });
});

test.describe("auth registration", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("register, stay signed in, then log out", async ({ page }) => {
    const email = `e2e.${Date.now()}@tell.test`;

    await registerUser(page, email);
    await expect(page.getByTestId("logout-button")).toBeVisible();

    await logoutUser(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("verify step requires matching password confirmation", async ({
    page,
  }) => {
    const email = `e2e.mismatch.${Date.now()}@tell.test`;
    await requestRegisterOtp(page, email);

    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-confirm-password").fill("TellSecure98!");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /passwords do not match/i,
    );
    await expect(page).toHaveURL(/\/register/);
  });

  test("verify step rejects weak passwords", async ({ page }) => {
    const email = `e2e.weak.${Date.now()}@tell.test`;
    await requestRegisterOtp(page, email);

    const weak = "alllowercase1!";
    await page.getByTestId("auth-password").fill(weak);
    await page.getByTestId("auth-confirm-password").fill(weak);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /uppercase|password must/i,
    );
    await expect(page).toHaveURL(/\/register/);
  });

  test("rejects duplicate email registration", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e.dupemail.${stamp}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/register");
    await page.getByTestId("auth-username").fill(`other${stamp}`.slice(0, 32));
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /already exists/i,
    );
  });

  test("rejects duplicate username registration", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e.dupuser.${stamp}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/register");
    await page.getByTestId("auth-username").fill(username);
    await page
      .getByTestId("auth-email")
      .fill(`e2e.dupuser2.${stamp}@tell.test`);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /username is already taken/i,
    );
  });

  test("rejects invalid OTP codes", async ({ page }) => {
    const email = `e2e.badotp.${Date.now()}@tell.test`;
    await requestRegisterOtp(page, email);

    await page.getByTestId("auth-otp").fill("000000");
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-confirm-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid|expired|code/i,
    );
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("auth login", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("login works with email after register", async ({ page }) => {
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

  test("login works with username after register", async ({ page }) => {
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

  test("login accepts email and username case-insensitively", async ({
    page,
  }) => {
    const email = `e2e.case.${Date.now()}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await loginUser(page, email.toUpperCase());
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
    await logoutUser(page);

    await loginUser(page, username.toUpperCase());
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
  });

  test("login fails with wrong password for email or username", async ({
    page,
  }) => {
    const email = `e2e.wrong.${Date.now()}@tell.test`;
    const username = e2eUsername(email);

    await registerUser(page, email, E2E_PASSWORD, username);
    await logoutUser(page);

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(email);
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email, username, or password/i,
    );

    await page.getByTestId("auth-identifier").fill(username);
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email, username, or password/i,
    );
  });
});
