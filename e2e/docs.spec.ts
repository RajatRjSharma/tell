import { expect, test } from "@playwright/test";

test.describe("swagger docs", () => {
  test("openapi json and /docs are public", async ({ page, request }) => {
    const spec = await request.get("/api/openapi");
    expect(spec.ok()).toBeTruthy();
    const body = (await spec.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
      components?: { securitySchemes?: Record<string, unknown> };
    };
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info.title).toBe("Tell API");
    expect(body.paths["/api/outlook"]).toBeTruthy();
    expect(body.paths["/api/auth/login"]).toBeTruthy();
    expect(body.components?.securitySchemes?.cookieAuth).toBeTruthy();
    expect(body.components?.securitySchemes?.bearerAuth).toBeTruthy();

    await page.goto("/docs");
    await expect(page.getByText("Tell API").first()).toBeVisible();
    await expect(page.locator(".swagger-ui")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("/api/outlook").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("/api/auth/login").first()).toBeVisible();
  });

  test("openapi.json link on docs header works", async ({ page }) => {
    await page.goto("/docs");
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/openapi")),
      page.getByRole("link", { name: "openapi.json" }).click(),
    ]);
    expect(response.ok()).toBeTruthy();
  });
});
