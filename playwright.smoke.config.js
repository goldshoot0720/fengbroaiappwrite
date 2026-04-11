const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: {
    baseURL: "https://fengbroaiappwrite.vercel.app",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1600, height: 1200 },
  },
});
