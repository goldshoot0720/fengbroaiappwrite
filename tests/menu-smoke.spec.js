const { test, expect } = require("@playwright/test");

const topLevelMenus = [
  /鋒兄首頁/,
  /鋒兄管理/,
  /^鋒兄工具$/,
  /^設定$/,
];

const groupedChildren = {
  鋒兄首頁: [/^首頁$/, /^儀表$/, /^訂閱$/],
  鋒兄管理: [
    /^食品$/,
    /^常用$/,
    /^銀行$/,
    /^筆記$/,
    /^音樂$/,
    /^圖片$/,
    /^影片$/,
    /^文件$/,
    /^播客$/,
    /^例行$/,
  ],
  鋒兄工具: [
    /^金融$/,
    /^新聞$/,
    /^比價$/,
    /^手機$/,
    /^Tube$/,
    /^圖片\+語音=影片$/,
    /^PNG\/JPEG$/,
    /^影片合併$/,
    /^YouTube\/Bilibili$/,
  ],
  設定: [/鋒兄設定/, /鋒兄關於/],
};

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

  for (const [group, children] of Object.entries(groupedChildren)) {
    const exactGroups = ["鋒兄工具", "設定"];
    await topNav.getByRole("button", { name: exactGroups.includes(group) ? new RegExp(`^${group}$`) : group }).first().click();
    await page.waitForTimeout(250);
    for (const label of children) {
      const button = topNav.getByRole("button", { name: label }).first();
      await expect(button, `子選單應可見: ${label}`).toBeVisible({ timeout: 10000 });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.waitForTimeout(450);
      await expect(page.locator("main")).toBeVisible();
    }
  }

  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(apiFailures, `API failures:\n${apiFailures.join("\n")}`).toEqual([]);
});

test("subscription currency dropdown", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);

  const topNav = await getDesktopTopNav(page);
  await topNav.getByRole("button", { name: /鋒兄首頁/ }).click();
  await page.waitForTimeout(250);
  await topNav.getByRole("button", { name: /^訂閱$/ }).click();
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
