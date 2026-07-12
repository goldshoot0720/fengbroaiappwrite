const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://fengbroaiappwrite.vercel.app",
    browserName: "chromium",
    channel: "chrome",
    headless: false, // 開啟瀏覽器可視測試
    viewport: { width: 1600, height: 1000 },
    launchOptions: {
      slowMo: 250,
    },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
