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
    await expect(page.getByTestId("map-view-asset-classes")).toHaveAttribute(
      "aria-selected",
      "true",
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

    const toolbar = page.getByTestId("map-toolbar");
    const toolbarBox = await toolbar.boundingBox();
    const mapTop = (await page.getByTestId("market-map-svg").boundingBox())?.y;
    await page.getByTestId("map-view-companies").click();
    await expect(page.getByTestId("map-view-companies")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/view=companies&period=1m/);
    await expect(page.getByTestId("map-about")).toContainText(
      /largest companies/i,
    );
    await expect(page.getByTestId("map-tile-co-TSM")).toBeVisible();
    expect(await toolbar.boundingBox()).toEqual(toolbarBox);
    expect((await page.getByTestId("market-map-svg").boundingBox())?.y).toBe(
      mapTop,
    );

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

  test("opens the view and period named in the URL", async ({ page }) => {
    await page.goto("/map?view=us-sectors&period=1w");
    await expect(page.getByTestId("map-view-us-sectors")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("map-period-1w")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("map-tile-sector-XLK")).toBeVisible();
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
