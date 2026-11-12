// End-to-end tests (T092/T093) against a running stack with mock providers:
//   node scripts/dev-stack.mjs --mock      (from the repo root; needs docker/compose.dev.yml up)
//   pnpm --filter @makvid/web test:e2e
// Chrome: the pinned chrome-headless-shell used by the renderer (no separate browser download).
import { defineConfig } from "@playwright/test";
import { findChrome } from "@makvid/renderer";

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "vi-VN",
    launchOptions: { executablePath: process.env.E2E_CHROME ?? findChrome() },
    trace: "retain-on-failure",
    // E2E_VIDEO=1 records the walkthrough (used for the milestone report).
    video: process.env.E2E_VIDEO === "1" ? { mode: "on", size: { width: 1280, height: 800 } } : "off",
    viewport: { width: 1280, height: 800 },
  },
});
