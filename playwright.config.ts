import { defineConfig, devices } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: process.env.BROWSER_REPORT ?? "reports/browser.json" },
    ],
  ],
  use: {
    baseURL:
      process.env.GAME_URL ?? pathToFileURL(resolve("dist/index.html")).href,
    offline: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "edge", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // Windows WebKit's offline emulation rejects file: navigation itself.
    // Remote HTTP(S) is blocked by the test fixture instead.
    { name: "webkit", use: { ...devices["Desktop Safari"], offline: false } },
  ],
});
