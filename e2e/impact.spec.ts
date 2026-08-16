import { expect, test } from "@playwright/test";

test.describe("event impact", () => {
  test("impact panel renders on home", async ({ page }) => {
    await page.route("**/api/events/impact?*", async (route) => {
      const source = new URL(route.request().url()).searchParams.get("source");
      const reportSource = source === "ECB" ? "ECB" : "Fed";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          report: {
            source: reportSource,
            sentimentFilter: "any",
            eventCount: 15,
            oldestEvent: "2026-02-18",
            newestEvent: "2026-07-29",
            horizons: ["1d", "1w", "1m"],
            assets: ["INDA"],
            rows: ["1d", "1w", "1m"].map((horizon) => ({
              symbol: "INDA",
              horizon,
              stats: { n: 12, mean: 0.01, median: 0.008, hitRateUp: 0.58 },
            })),
            disclaimer: "Historical analogues only.",
          },
        }),
      });
    });
    await page.goto("/");
    await expect(page.getByTestId("event-impact-panel")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("event-impact-panel")).toContainText(
      "matching historical releases",
    );
    await expect(page.getByTestId("impact-row-INDA")).toBeVisible();

    await page.getByTestId("impact-source").selectOption("ECB");
    await expect(page.getByTestId("event-impact-panel")).toContainText(
      /ECB · \d+ matching historical releases/,
    );
    await expect(page.getByTestId("event-impact-panel")).not.toContainText(
      "source chosen from SPY",
    );
  });
});
