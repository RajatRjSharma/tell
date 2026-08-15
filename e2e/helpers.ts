import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { PROTECTED_API_GET_PATHS } from "../src/lib/api/protected-paths";

export const hasTurso =
  Boolean(process.env.TURSO_DATABASE_URL) &&
  Boolean(process.env.TURSO_AUTH_TOKEN) &&
  Boolean(process.env.JWT_SECRET);

export const E2E_PASSWORD = "TellSecure99!";

export { PROTECTED_API_GET_PATHS };

export function e2eOrigin(baseURL?: string | null): string {
  const raw = baseURL || process.env.APP_URL || "http://127.0.0.1:3100";
  return raw.replace(/\/$/, "");
}

export function e2eUsername(email: string): string {
  const stamp = String(Date.now()).slice(-6);
  const local = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);
  const base =
    /^[a-z]/.test(local) && local.length >= 2 ? local : `u${local || "ser"}`;
  return `${base}${stamp}`.slice(0, 32);
}

export async function waitForAuthNav(page: Page) {
  await expect(page.getByTestId("auth-nav")).toBeVisible({ timeout: 15_000 });
  await openAuthMenuIfNeeded(page);
}

/** Open the compact header menu when logout/nav controls are collapsed. */
export async function openAuthMenuIfNeeded(page: Page) {
  const trigger = page.getByTestId("mobile-menu-trigger");
  if (!(await trigger.isVisible())) return;

  const logout = page.getByTestId("logout-button");
  const signIn = page.getByTestId("nav-signin");
  if ((await logout.isVisible()) || (await signIn.isVisible())) return;

  await trigger.click();
  await expect(logout.or(signIn)).toBeVisible();
}

/** Start registration through OTP request; leaves the form on the verify step. */
export async function requestRegisterOtp(
  page: Page,
  email: string,
  username: string = e2eUsername(email),
) {
  await page.goto("/register");
  await expect(page.getByTestId("auth-form")).toBeVisible();
  await page.getByTestId("auth-username").fill(username);
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

  await expect(page.getByTestId("auth-title")).toHaveText("Verify email");
  await expect(page.getByTestId("auth-password")).toBeVisible();
  await expect(page.getByTestId("auth-confirm-password")).toBeVisible();
  return username;
}

export async function registerUser(
  page: Page,
  email: string,
  password: string = E2E_PASSWORD,
  username: string = e2eUsername(email),
) {
  await requestRegisterOtp(page, email, username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-confirm-password").fill(password);
  await Promise.all([
    page.waitForURL("/", { timeout: 20_000 }),
    page.getByTestId("auth-submit").click(),
  ]);
  await waitForAuthNav(page);
  await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
}

export async function loginUser(
  page: Page,
  identifier: string,
  password: string = E2E_PASSWORD,
) {
  await page.goto("/login");
  await page.getByTestId("auth-identifier").fill(identifier);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("/");
  await waitForAuthNav(page);
}

export async function logoutUser(page: Page) {
  await openAuthMenuIfNeeded(page);
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByTestId("auth-title")).toHaveText("Sign in");
}

/** Read session cookie from the browser context (set by login / OTP verify). */
export async function getSessionCookie(
  page: Page,
): Promise<{ name: string; value: string }> {
  const cookies = await page.context().cookies();
  const session = cookies.find(
    (cookie) =>
      cookie.name === "tell_session" || cookie.name.endsWith("_session"),
  );
  expect(
    session,
    `expected session cookie, got: ${cookies.map((c) => c.name).join(",") || "(none)"}`,
  ).toBeTruthy();
  return { name: session!.name, value: session!.value };
}

/** Authenticated fetch via the page so the browser cookie jar is used. */
export async function pageApiGet(
  page: Page,
  path: string,
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(async (apiPath) => {
    const res = await fetch(apiPath, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }, path);
}

/** Register via UI then return the session cookie for APIRequestContext calls. */
export async function registerAndGetCookie(
  page: Page,
  email: string,
  password: string = E2E_PASSWORD,
) {
  await registerUser(page, email, password);
  return getSessionCookie(page);
}

/** Register via API (OTP echo). Prefer page-based helpers when cookie auth is needed. */
export async function registerViaApi(
  request: APIRequestContext,
  email: string,
  options?: { password?: string; origin?: string; username?: string },
) {
  const origin = options?.origin ?? e2eOrigin();
  const password = options?.password ?? E2E_PASSWORD;
  const username = options?.username ?? e2eUsername(email);
  const headers = {
    Origin: origin,
    "Content-Type": "application/json",
  };

  const otpRes = await request.post("/api/auth/otp/request", {
    headers,
    data: { email, username, purpose: "register" },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { devCode?: string };
  expect(otpBody.devCode, "TELL_OTP_DEV_ECHO must expose devCode").toBeTruthy();

  const verifyRes = await request.post("/api/auth/otp/verify", {
    headers,
    data: {
      email,
      username,
      password,
      confirmPassword: password,
      otp: otpBody.devCode,
      purpose: "register",
    },
  });
  expect(verifyRes.status(), await verifyRes.text()).toBe(201);

  const setCookie = verifyRes
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie");
  const jar = await request.storageState();
  const hasSession = jar.cookies.some(
    (cookie) =>
      cookie.name === "tell_session" || cookie.name.endsWith("_session"),
  );
  if (!hasSession && setCookie.length === 0) {
    throw new Error(
      "OTP verify succeeded but no session cookie was returned to the API request context",
    );
  }
}
