import { defineConfig, devices } from "@playwright/test";

import {
  TEST_PRIVATE_KEY_PEM,
  TEST_PUBLIC_KEY_PEM,
} from "./test/fixtures/signing-keys";

const releaseBrowsers = process.env.CONCIERGE_RELEASE_BROWSERS === "1";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  retries: process.env.CI === "1" ? 1 : 0,
  reporter: process.env.CI === "1" ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: process.env.CI !== "1",
    timeout: 240_000,
    env: {
      CONCIERGE_DETERMINISTIC_TEST: "1",
      // The production build is served over loopback HTTP for browser tests.
      // bootstrap accepts this only together with deterministic-test mode.
      CONCIERGE_ALLOW_INSECURE_TEST_COOKIE: "1",
      CONCIERGE_ES256_PRIVATE_KEY_PEM: TEST_PRIVATE_KEY_PEM,
      CONCIERGE_ES256_PUBLIC_KEY_PEM: TEST_PUBLIC_KEY_PEM,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(releaseBrowsers
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
});
