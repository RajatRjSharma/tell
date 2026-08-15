import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("watchlist", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("star a symbol, filter watchlist, then remove", async ({ page }) => {
    const email = `e2e.watch.${Date.now()}@tell.test`;

    await registerUser(page, email);

    await page.getByTestId("asset-filter").selectOption("all");
    const star = page.getByTestId("watch-toggle-SPY");
    await expect(star).toBeVisible();
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("asset-filter").selectOption("watchlist");
    await expect(page.getByTestId("outlook-row-SPY")).toBeVisible();
    await expect(page.getByTestId("outlook-empty")).toHaveCount(0);

    await page.getByTestId("watch-toggle-SPY").click();
    await expect(page.getByTestId("outlook-empty")).toBeVisible();
  });
});
