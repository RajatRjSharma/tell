import { expect, test } from "@playwright/test";

test.describe("chart hover readouts", () => {
  test("macro sparkline shows past values with a plain meaning", async ({
    page,
  }) => {
    await page.goto("/");
    const meaning = page.getByTestId("macro-meaning-VIXCLS");
    await expect(meaning).toContainText("Calm", { timeout: 20_000 });

    const spark = page.getByTestId("macro-spark-VIXCLS");
    const box = await spark.boundingBox();
    if (!box) throw new Error("sparkline not laid out");
    await spark.hover({ position: { x: 1, y: box.height / 2 } });

    await expect(page.getByTestId("macro-scrub-VIXCLS")).toBeVisible();
    await expect(page.getByTestId("macro-item-VIXCLS")).toContainText("18.0");
    await expect(meaning).toContainText("Normal");

    await page.mouse.move(0, 0);
    await expect(page.getByTestId("macro-scrub-VIXCLS")).toHaveCount(0);
  });

  test("price chart tooltip follows the pointer and the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    const chart = page.getByTestId("price-chart-svg");
    await expect(chart).toBeVisible({ timeout: 20_000 });

    await chart.hover();
    const tooltip = page.getByTestId("price-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("since");

    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);

    await chart.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Home");
    await expect(tooltip).toContainText("+0.00%");
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });
});
