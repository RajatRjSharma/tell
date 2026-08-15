import { expect, test, type Page } from "@playwright/test";

const protectedRoutes = [
  { path: "/", ready: "[data-testid='home-heading']" },
  { path: "/methodology", ready: "#methodology-content" },
  { path: "/system", ready: "[data-testid='system-page']" },
  { path: "/docs", ready: ".swagger-wrap" },
] as const;

async function assertNoOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(dimensions, `${label} exceeds the viewport`).toEqual({
    viewport: dimensions.viewport,
    html: dimensions.viewport,
    body: dimensions.viewport,
  });

  const clipped = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const selectors = [
      "[data-testid='auth-nav']",
      "[data-testid='mobile-menu-trigger']",
      "[data-testid='ask-tell-button']",
      "[data-testid='home-heading']",
      "[data-testid='macro-strip']",
      "[data-testid='system-page']",
      "#methodology-content",
    ];

    return selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        if (rect.left < -1 || rect.right > viewportWidth + 1) {
          return {
            selector,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            viewportWidth,
          };
        }
        return null;
      })
      .filter(Boolean);
  });

  expect(clipped, `${label} has clipped interactive content`).toEqual([]);
}

test.describe("mobile responsiveness", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    test(`keeps core pages inside a ${viewport.width}x${viewport.height} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      for (const route of protectedRoutes) {
        await page.goto(route.path);
        await page.locator(route.ready).waitFor();
        await assertNoOverflow(
          page,
          `${route.path} at ${viewport.width}x${viewport.height}`,
        );
      }
    });
  }

  test("compact header exposes every destination from one menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/");

    await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
    await page.getByTestId("mobile-menu-trigger").click();
    await expect(page.getByTestId("nav-outlook")).toBeVisible();
    await expect(page.getByTestId("nav-methodology")).toBeVisible();
    await expect(page.getByTestId("nav-system")).toBeVisible();
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });
});
