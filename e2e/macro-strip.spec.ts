import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("macro strip", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("sparkline strip renders under the hero", async ({ page }) => {
    await registerUser(page, `e2e.macro.${Date.now()}@tell.test`);
    await expect(page.getByTestId("macro-strip")).toBeVisible({
      timeout: 20_000,
    });
  });
});
