import { expect, test } from "@playwright/test";
import { hasTurso, registerUser } from "./helpers";

test.describe("policy events", () => {
  test.skip(!hasTurso, "Requires TURSO_* and JWT_SECRET in environment");

  test("events panel renders on home", async ({ page }) => {
    await registerUser(page, `e2e.events.${Date.now()}@tell.test`);
    await expect(page.getByTestId("events-panel")).toBeVisible({
      timeout: 20_000,
    });
  });
});
