const { test, expect } = require("@playwright/test");

// 頂層選單（不含需展開的子項目）
const topLevelMenus = [
  /鋒兄首頁/,
  /鋒兄儀表/,
  /鋒兄訂閱/,
  /鋒兄食品/,
  /鋒兄常用/,
  /鋒兄圖片/,
  /鋒兄影片/,
  /鋒兄音樂/,
  /鋒兄播客/,
  /鋒兄銀行/,
  /鋒兄例行/,
  /鋒兄設定/,
  /鋒兄關於/,
];

// 鋒兄筆記/文件、鋒兄工具子選單（上方選單改為直接平鋪顯示）
const notesDocsChildren = [/鋒兄筆記/, /鋒兄文件/];
const toolsChildren = [/鋒兄比價/, /手機比價/, /鋒兄Tube/, /鋒兄金融/, /鋒兄新聞/, /圖片語音影片/];

async function getDesktopTopNav(page) {
  const nav = page.locator("#desktop-top-nav");
  await expect(nav).toBeVisible({ timeout: 20000 });
  return nav;
}

test.use({ viewport: { width: 1440, height: 900 } });

test("desktop top menu smoke test", async ({ page }) => {
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
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  const topNav = await getDesktopTopNav(page);
  await expect(topNav.getByText("Design Mode")).toBeVisible();

  for (const label of topLevelMenus) {
    const button = topNav.getByRole("button", { name: label }).first();
    await expect(button, `選單應可見: ${label}`).toBeVisible({ timeout: 10000 });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForTimeout(450);
    await expect(page.locator("main")).toBeVisible();
  }

  // 筆記/文件、工具子項目在上方選單直接顯示（無需再展開）
  for (const label of [...notesDocsChildren, ...toolsChildren]) {
    const button = topNav.getByRole("button", { name: label }).first();
    await expect(button, `子選單應可見: ${label}`).toBeVisible({ timeout: 10000 });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForTimeout(450);
    await expect(page.locator("main")).toBeVisible();
  }

  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(apiFailures, `API failures:\n${apiFailures.join("\n")}`).toEqual([]);
});

test("subscription currency dropdown", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  const topNav = await getDesktopTopNav(page);
  await topNav.getByRole("button", { name: /鋒兄訂閱/ }).click();
  await page.waitForTimeout(1000);

  // 開啟新增表單
  const addButton = page.getByRole("button", { name: /新增|加入|建立/ }).first();
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
    await page.waitForTimeout(800);
  }

  const currencyTrigger = page
    .locator('[aria-label="幣別"]')
    .or(page.getByRole("combobox").filter({ hasText: /TWD|台幣|幣別|選擇幣別/ }))
    .first();

  await expect(currencyTrigger).toBeVisible({ timeout: 15000 });
  await currencyTrigger.click();
  await page.waitForTimeout(400);

  await expect(page.getByRole("option", { name: /USD/ }).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("option", { name: /TWD/ }).first()).toBeVisible();
  await page.getByRole("option", { name: /USD/ }).first().click();
  await page.waitForTimeout(300);
});
