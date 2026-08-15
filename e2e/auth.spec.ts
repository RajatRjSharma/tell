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
});

test.describe("auth flow", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("register, stay signed in, then log out", async ({ page }) => {
    const email = `e2e.${Date.now()}@tell.test`;
    const password = "TellSecure99!";

    await registerUser(page, email, password);
    await expect(page.getByTestId("logout-button")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await waitForAuthNav(page);
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-register")).toBeVisible();
  });

  test("rejects duplicate registration", async ({ page }) => {
    const email = `e2e.dup.${Date.now()}@tell.test`;
    const password = "TellSecure99!";

    await registerUser(page, email, password);
    await page.getByTestId("logout-button").click();
    await waitForAuthNav(page);

    await page.goto("/register");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /already exists/i,
    );
  });

  test("login works after register", async ({ page }) => {
    const email = `e2e.login.${Date.now()}@tell.test`;
    const password = "TellSecure99!";

    await registerUser(page, email, password);
    await page.getByTestId("logout-button").click();
    await waitForAuthNav(page);

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);
    await expect(page.getByTestId("user-email")).toHaveText(email);
  });

  test("login fails with wrong password", async ({ page }) => {
    const email = `e2e.wrong.${Date.now()}@tell.test`;
    const password = "TellSecure99!";

    await registerUser(page, email, password);
    await page.getByTestId("logout-button").click();
    await waitForAuthNav(page);

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("WrongPass999!");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid email or password/i,
    );
  });
});
