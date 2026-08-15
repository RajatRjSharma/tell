import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Prefer 3100 locally so `next dev` on 3000 doesn't collide.
const PORT = Number(
  process.env.PLAYWRIGHT_PORT ?? (process.env.CI ? 3000 : 3100),
);
const baseURL = `http://127.0.0.1:${PORT}`;
const databasePath = resolve(process.cwd(), ".tmp/playwright.db");
const authStatePath = resolve(process.cwd(), "e2e/.auth/user.json");

/**
 * Isolated e2e env: no production secrets, OTP echo, delivery off, live quotes
 * off, and rate limits high enough for the auth suite (limits still enforced).
 */
const testEnv = {
  APP_ENV: "test",
  APP_URL: baseURL,
  JWT_SECRET: "playwright-isolated-jwt-secret-32chars!!",
  JWT_ISSUER: "tell-e2e",
  TURSO_DATABASE_URL: `file:${databasePath}`,
  TURSO_AUTH_TOKEN: "e2e-local-token",
  TELL_OTP_DEV_ECHO: "1",
  REGISTRATION_ENABLED: "true",
  EMAIL_OTP_ENABLED: "true",
  EMAIL_DELIVERY_ENABLED: "false",
  LIVE_MARKET_QUOTES: "false",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_FROM: "",
  FRED_API_KEY: "",
  FINNHUB_API_KEY: "",
  GEMINI_API_KEY: "",
  GROQ_API_KEY: "",
  AUTH_RATE_LIMIT_PER_MINUTE: "600",
  API_RATE_LIMIT_PER_MINUTE: "300",
  WRITE_RATE_LIMIT_PER_MINUTE: "120",
  HEALTH_RATE_LIMIT_PER_MINUTE: "300",
  BRIEF_RATE_LIMIT_PER_MINUTE: "120",
  CHAT_RATE_LIMIT_PER_MINUTE: "120",
};

Object.assign(process.env, testEnv);

const signedInSpecs = [
  /events\.spec\.ts/,
  /impact\.spec\.ts/,
  /macro-strip\.spec\.ts/,
  /methodology\.spec\.ts/,
  /responsive\.spec\.ts/,
  /system\.spec\.ts/,
];

const anonymousSpecs = [
  /alerts\.spec\.ts/,
  /api-auth\.spec\.ts/,
  /auth\.spec\.ts/,
  /docs\.spec\.ts/,
  /gate\.spec\.ts/,
  /home\.spec\.ts/,
  /watchlist\.spec\.ts/,
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
      dependencies: ["setup"],
      testMatch: signedInSpecs,
    },
    {
      name: "chromium-anon",
      use: { ...devices["Desktop Chrome"] },
      testMatch: anonymousSpecs,
    },
  ],
  webServer: {
    command: `npm run test:e2e:setup && npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      ...testEnv,
    },
  },
});
