import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
  e2eOrigin,
  e2eUsername,
  getSessionCookie,
  hasTurso,
  pageApiGet,
  PROTECTED_API_GET_PATHS,
  registerUser,
  registerViaApi,
} from "./helpers";

test.describe("api auth", () => {
  test("public bootstrap endpoints stay open", async ({ request }) => {
    for (const path of [
      "/api/auth/config",
      "/api/health",
      "/api/ready",
      "/api/openapi",
    ]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
    }
  });

  test("product GET APIs require a session", async ({ request }) => {
    for (const path of PROTECTED_API_GET_PATHS) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error, path).toBeTruthy();
    }
  });

  test("mutating product APIs reject anonymous callers", async ({
    request,
    baseURL,
  }) => {
    const origin = e2eOrigin(baseURL);
    const headers = { Origin: origin, "Content-Type": "application/json" };

    const chat = await request.post("/api/chat", {
      headers,
      data: { message: "hi" },
    });
    expect([401, 403]).toContain(chat.status());

    const watchlist = await request.post("/api/watchlist", {
      headers,
      data: { symbol: "SPY" },
    });
    expect([401, 403]).toContain(watchlist.status());

    const alerts = await request.post("/api/alerts", {
      headers,
      data: { symbol: "SPY", ruleType: "direction_change" },
    });
    expect([401, 403]).toContain(alerts.status());
  });
});

test.describe("api auth (signed in)", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("browser session unlocks outlook and assets", async ({ page }) => {
    const email = `e2e.apireg.${Date.now()}@tell.test`;
    await registerUser(page, email);
    await getSessionCookie(page);

    const outlook = await pageApiGet(page, "/api/outlook");
    expect(outlook.status).toBe(200);
    const body = outlook.json as { signals?: unknown[] };
    expect(Array.isArray(body.signals)).toBe(true);

    const assets = await pageApiGet(page, "/api/assets");
    expect(assets.status).toBe(200);
  });

  test("registerViaApi creates an account usable by email or username login", async ({
    page,
    request,
    baseURL,
  }) => {
    const email = `e2e.apionly.${Date.now()}@tell.test`;
    const username = e2eUsername(email);
    await registerViaApi(request, email, {
      origin: e2eOrigin(baseURL),
      username,
    });

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(email);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);

    const me = await pageApiGet(page, "/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({
      user: { email, username },
    });

    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByTestId("auth-identifier").fill(username);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("user-email")).toHaveText(`@${username}`);
  });

  test("otp verify rejects mismatched confirmPassword", async ({
    request,
    baseURL,
  }) => {
    const origin = e2eOrigin(baseURL);
    const email = `e2e.confirmapi.${Date.now()}@tell.test`;
    const username = e2eUsername(email);
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
    expect(otpBody.devCode).toBeTruthy();

    const verifyRes = await request.post("/api/auth/otp/verify", {
      headers,
      data: {
        email,
        username,
        password: E2E_PASSWORD,
        confirmPassword: "TellSecure98!",
        otp: otpBody.devCode,
        purpose: "register",
      },
    });
    expect(verifyRes.status()).toBe(400);
    const body = (await verifyRes.json()) as { error?: string };
    expect(body.error).toMatch(/passwords do not match/i);
  });
});
