import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for muuney.hub smoke tests.
 *
 * Default BASE_URL aponta para prod (https://muuney.app) para smoke tests rápidos.
 * Para testar contra preview/dev, passe PLAYWRIGHT_BASE_URL como env var:
 *   PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run e2e
 *
 * Credentials: fornecer via env vars E2E_USER_EMAIL + E2E_USER_PASSWORD.
 * Em CI, esses segredos vêm do GitHub Secrets.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://muuney.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
