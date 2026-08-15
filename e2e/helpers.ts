import { expect, type Page } from "@playwright/test";

export const hasTurso =
  Boolean(process.env.TURSO_DATABASE_URL) &&
  Boolean(process.env.TURSO_AUTH_TOKEN) &&
  Boolean(process.env.JWT_SECRET);

export const E2E_PASSWORD = "TellSecure99!";

export async function waitForAuthNav(page: Page) {
  await expect(page.getByTestId("auth-nav")).toBeVisible({ timeout: 15_000 });
}

export async function registerUser(
  page: Page,
  email: string,
  password: string = E2E_PASSWORD,
) {
  await page.goto("/register");
  await expect(page.getByTestId("auth-form")).toBeVisible();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-submit").click();

  const otp = page.getByTestId("auth-otp");
  const error = page.getByTestId("auth-error");
  await expect(otp.or(error)).toBeVisible({ timeout: 15_000 });
  if (await error.isVisible()) {
    throw new Error(`OTP request failed: ${await error.innerText()}`);
  }

  const otpValue = await otp.inputValue();
  if (!otpValue) {
    const info = page.getByTestId("auth-info");
    await expect(info).toBeVisible();
    const text = await info.innerText();
    const match = text.match(/\b(\d{4,8})\b/);
    expect(match?.[1], "expected OTP code in auth-info").toBeTruthy();
    await otp.fill(match![1]!);
  }

  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("/");
  await waitForAuthNav(page);
  await expect(page.getByTestId("user-email")).toHaveText(email);
}

export async function logoutUser(page: Page) {
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("nav-signin")).toBeVisible({ timeout: 15_000 });
}
