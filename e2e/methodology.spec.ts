import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("methodology", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("page renders disclaimer and is linked from home", async ({ page }) => {
    await registerUser(page, `e2e.method.${Date.now()}@tell.test`);
    await page.getByTestId("nav-methodology").click();
    await expect(page).toHaveURL(/\/methodology/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /How Tell reads the market/i,
    );
    await expect(page.getByTestId("methodology-disclaimer")).toBeVisible();
  });
});
