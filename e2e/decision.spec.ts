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
});
