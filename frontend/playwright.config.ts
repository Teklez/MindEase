import { defineConfig, devices } from "@playwright/test";

import { BASE_URL } from "./e2e/helpers/env";

// Run against the Docker Compose stack already on localhost:3000/:8000.
// Boot the stack with `docker compose up -d` before running these.
export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/.artifacts/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Local suite hits the live backend under parallel-worker load, so a
  // single retry absorbs the occasional "socket hang up" without paying
  // the cost of a full re-run. CI gets two for the same reason × harder
  // network.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "./e2e/.artifacts/playwright-report", open: "never" }],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
