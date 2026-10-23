import { expect, test, type Page } from "@playwright/test";

const LIGHT_PAGE = "rgb(243, 244, 242)";
const DARK_PAGE = "rgb(17, 23, 19)";

function pageBackground(page: Page) {
  return page.evaluate(
    () => getComputedStyle(document.querySelector("main")!).backgroundColor,
  );
}

test.describe("theme", () => {
  test("follows the system until the user picks one", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await expect(page.getByTestId("theme-system")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await pageBackground(page)).toBe(DARK_PAGE);

    await page.emulateMedia({ colorScheme: "light" });
    expect(await pageBackground(page)).toBe(LIGHT_PAGE);
  });

  test("keeps the chosen theme across reloads without errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await pageBackground(page)).toBe(DARK_PAGE);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("theme-dark")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await pageBackground(page)).toBe(DARK_PAGE);
    await expect(
      page.locator('meta[name="theme-color"]').first(),
    ).toHaveAttribute("content", "#111713");

    await page.getByTestId("theme-system").click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    expect(await pageBackground(page)).toBe(LIGHT_PAGE);

    expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([]);
  });

  test("arrow keys move between options", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("theme-system").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("theme-light")).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("theme-system")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
