import { expect, test } from "@playwright/test";
import { openAuthMenuIfNeeded, pageApiGet } from "./helpers";

test.describe("market map", () => {
  test("opens from the nav and draws the asset-class treemap", async ({
    page,
  }) => {
    await page.goto("/");
    await openAuthMenuIfNeeded(page);
    await page.getByTestId("nav-map").click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByTestId("map-page")).toBeVisible();
    await expect(page.getByTestId("map-view-select")).toHaveValue(
      "asset-classes",
    );

    await expect(page.getByTestId("map-group-equities")).toBeVisible();
    await expect(page.getByTestId("map-group-bonds")).toBeVisible();
    await expect(page.getByTestId("map-group-gold")).toBeVisible();

    const us = page.getByTestId("map-tile-equity-US");
    await expect(us).not.toHaveAttribute("data-change", "");
    await us.hover();
    await expect(page.getByTestId("map-tooltip")).toContainText(
      "United States",
    );
    await expect(page.getByTestId("map-tooltip")).toContainText("of Equities");
  });

  test("switches period and view, zooms into a group, and steps back", async ({
    page,
  }) => {
    await page.goto("/map");
    await expect(page.getByTestId("market-map-svg")).toBeVisible();

    await page.getByTestId("map-period-1m").click();
    await expect(page.getByTestId("map-period-1m")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("map-gainers")).toContainText("1 month");

    await page.getByTestId("map-view-select").selectOption("companies");
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      /largest companies/i,
    );
    await expect(page.getByTestId("map-tile-co-TSM")).toBeVisible();

    await page.getByTestId("map-group-country-US").focus();
    await page.keyboard.press("Enter");
    const breadcrumb = page.getByTestId("map-breadcrumb");
    await expect(breadcrumb).toContainText("United States");
    await expect(page.getByTestId("map-tile-co-AAPL")).toBeVisible();
    await expect(page.getByTestId("map-tile-co-TSM")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(breadcrumb).not.toContainText("United States");
    await expect(page.getByTestId("map-tile-co-TSM")).toBeVisible();
  });

  test("serves every view from the API", async ({ page }) => {
    await page.goto("/map");
    const { status, json } = await pageApiGet(page, "/api/market-map");
    expect(status).toBe(200);
    const body = json as { views: Array<{ id: string }> };
    expect(body.views.map((view) => view.id)).toEqual([
      "asset-classes",
      "countries",
      "companies",
      "us-sectors",
      "markets",
    ]);
  });
});
