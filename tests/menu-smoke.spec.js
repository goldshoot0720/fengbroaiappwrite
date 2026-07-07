const { test, expect } = require("@playwright/test");

const menuItems = [
  "擐?",
  "蝮質汗?銵冽",
  "閮蝞∠?",
  "憌?蝞∠?",
  "蝑?鞈?",
  "撣貊撣唾?",
  "??摨?",
  "敶梁?摨?",
  "?單?摨?",
  "?辣銝剖?",
  "Podcast",
  "?銵?鞈",
  "靘?餈質馱",
  "??撌亙",
  "閮剖?",
  "?蝟餌絞",
];

test("sidebar menu smoke test", async ({ page }) => {
  const pageErrors = [];
  const apiFailures = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/") && response.status() >= 500) {
      apiFailures.push(`${response.status()} ${url}`);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const sidebar = page.locator("aside").first();

  for (const label of menuItems) {
    const item = sidebar.getByRole("button", { name: label }).first();
    await expect(item).toBeVisible();
    await item.click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(600);
  }

  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(apiFailures, `API failures:\n${apiFailures.join("\n")}`).toEqual([]);
});
