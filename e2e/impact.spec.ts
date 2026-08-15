import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("event impact", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("impact panel renders on home", async ({ page }) => {
    await registerUser(page, `e2e.impact.${Date.now()}@tell.test`);
    await expect(page.getByTestId("event-impact-panel")).toBeVisible({
      timeout: 20_000,
    });
  });
});
