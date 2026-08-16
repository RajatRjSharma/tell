import { expect, test } from "@playwright/test";

test.describe("beginner decision UX", () => {
  test("home shows decision summary and regime explainer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("decision-summary")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("decision-summary")).toContainText(
      /What this means|Lean|Mixed|Unclear/i,
    );
    await expect(page.getByTestId("regime-explainer")).toBeVisible();
    await page.getByTestId("regime-explainer-toggle").click();
    await expect(page.getByTestId("regime-input-cpiYoy")).toBeVisible();
    await expect(page.getByTestId("near-term-bias")).toContainText(
      /Next session bias|Latest 1d average/,
    );
  });

  test("one selector scopes the page by country and region", async ({
    page,
  }) => {
    await page.goto("/");
    const scope = page.getByTestId("market-scope");
    await expect(scope).toBeVisible({ timeout: 20_000 });

    await scope.selectOption("country:IN");
    await expect(page.getByTestId("market-scope-control")).toContainText(
      "Viewing India",
    );
    await expect(page.getByTestId("decision-summary")).toContainText("India");
    await expect(page.getByTestId("outlook-row-INDA")).toBeVisible();
    await expect(page.getByTestId("outlook-row-SPY")).toHaveCount(0);
    await expect(page.getByTestId("regime-explainer")).toContainText(
      "Always US macro conditions",
    );
    await expect(page.getByTestId("market-scope-control")).toContainText(
      "Everything below this control",
    );

    await scope.selectOption("region:Europe");
    await expect(page.getByTestId("market-scope-control")).toContainText(
      "Viewing Europe",
    );
    await expect(page.getByTestId("outlook-row-EWG")).toBeVisible();
    await expect(page.getByTestId("outlook-row-EWU")).toBeVisible();
    await expect(page.getByTestId("outlook-row-EURUSD")).toBeVisible();
    await expect(page.getByTestId("outlook-row-GBPUSD")).toBeVisible();
    await expect(page.getByTestId("outlook-row-INDA")).toHaveCount(0);
  });
});
