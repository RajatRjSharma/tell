import { expect, test } from "@playwright/test";
import {
  E2E_PASSWORD,
  e2eOrigin,
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

  test("registerViaApi creates an account usable by login", async ({
    page,
    request,
    baseURL,
  }) => {
    const email = `e2e.apionly.${Date.now()}@tell.test`;
    await registerViaApi(request, email, { origin: e2eOrigin(baseURL) });

    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("user-email")).toHaveText(email);
  });
});
