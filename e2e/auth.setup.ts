import { expect, test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  E2E_PASSWORD,
  e2eOrigin,
  e2eUsername,
  registerViaApi,
  waitForAuthNav,
} from "./helpers";

const authFile = resolve(__dirname, ".auth/user.json");

setup(
  "authenticate once for signed-in product specs",
  async ({ page, request, baseURL }) => {
    mkdirSync(dirname(authFile), { recursive: true });

    const email = `e2e.shared.${Date.now()}@tell.test`;
    const username = e2eUsername(email);
    await registerViaApi(request, email, {
      origin: e2eOrigin(baseURL),
      username,
    });

    await page.goto("/login");
    await page.getByTestId("auth-identifier").fill(username);
    await page.getByTestId("auth-password").fill(E2E_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("/");
    await waitForAuthNav(page);

    await page.context().storageState({ path: authFile });
  },
);
