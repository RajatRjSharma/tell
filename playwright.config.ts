import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });

// Default away from 3000 so local `make dev` does not block e2e webServer.
const PORT = Number(
  process.env.PLAYWRIGHT_PORT ?? (process.env.CI ? 3000 : 3100),
);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Auth-heavy specs share one IP; parallel workers trip rate limits.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      JWT_SECRET:
        process.env.JWT_SECRET ?? "playwright-local-jwt-secret-32chars!!",
      JWT_ISSUER: process.env.JWT_ISSUER ?? "tell",
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ?? "",
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ?? "",
      TELL_OTP_DEV_ECHO: "1",
      REGISTRATION_ENABLED: "true",
      EMAIL_OTP_ENABLED: "true",
      // Avoid flaky 429s when many auth flows run in one suite.
      AUTH_RATE_LIMIT_PER_MINUTE: "300",
      API_RATE_LIMIT_PER_MINUTE: "300",
      WRITE_RATE_LIMIT_PER_MINUTE: "120",
      HEALTH_RATE_LIMIT_PER_MINUTE: "300",
      BRIEF_RATE_LIMIT_PER_MINUTE: "120",
      CHAT_RATE_LIMIT_PER_MINUTE: "120",
    },
  },
});
