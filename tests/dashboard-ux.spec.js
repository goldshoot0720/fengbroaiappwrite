const { test, expect } = require("@playwright/test");

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
});

test("module search supports keyboard selection, empty results and focus restoration", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "搜尋模組", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "全部模組" });
  const search = dialog.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("沒有這個功能");
  await expect(dialog.getByText("沒有符合的模組")).toBeVisible();
  await dialog.getByRole("button", { name: "清除搜尋" }).click();
  await expect(search).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Control+k");
  await search.fill("ｂａｎｋ");
  await expect(dialog.getByRole("button", { name: "銀行" })).toBeVisible();
  await search.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveTitle(/銀行/);
  await page.reload();
  await expect(page).toHaveTitle(/銀行/);
});

test.describe("touch navigation", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("opens without summoning the keyboard and remains dismissible across breakpoints", async ({ page }) => {
    await page.goto("/");
    const more = page.getByRole("button", { name: "更多模組" });
    await more.tap();
    const dialog = page.getByRole("dialog", { name: "全部模組" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("searchbox")).not.toBeFocused();
    await expect(dialog.locator('[aria-current="page"]')).toHaveText("首頁");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");

    await page.setViewportSize({ width: 820, height: 940 });
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await dialog.getByRole("button", { name: "關閉選單" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");

    await page.setViewportSize({ width: 390, height: 844 });
    await more.tap();
    await dialog.getByRole("searchbox").fill("票不存在");
    await dialog.getByRole("button", { name: "清除搜尋" }).tap();
    await dialog.getByRole("button", { name: "筆記", exact: true }).tap();
    await expect(page).toHaveTitle(/筆記/);
  });
});

test("home distinguishes a pending request, failed check, confirmed tasks and an empty result", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("appwrite_custom_config_saved", "true");
    localStorage.setItem("NEXT_PUBLIC_APPWRITE_ENDPOINT", "https://fixture.invalid/v1");
    localStorage.setItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    localStorage.setItem("APPWRITE_DATABASE_ID", "test-database");
    localStorage.setItem("APPWRITE_API_KEY", "fixture-only");
    localStorage.setItem("APPWRITE_BUCKET_ID", "test-bucket");
  });

  const foodResponse = Promise.withResolvers();
  const storageResponse = Promise.withResolvers();
  let failFood = true;
  let foods = [{ $id: "expired", name: "牛奶", todate: "2020-06-01" }];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/food") {
      await foodResponse.promise;
      return failFood
        ? route.fulfill({ status: 503, json: { error: "暫時無法連線" } })
        : route.fulfill({ json: foods });
    }
    if (path === "/api/storage-stats") {
      await storageResponse.promise;
      return route.fulfill({ json: { stats: { totalFiles: 2 } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/");
  await expect(page.getByText("正在確認到期與扣款項目…")).toBeVisible();
  await expect(page.getByText("目前沒有緊急項目。")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "常用功能" }).getByRole("button").first()).toBeEnabled();

  foodResponse.resolve();
  await expect(page.getByText("暫時無法確認待辦項目。")).toBeVisible();
  failFood = false;
  await page.getByRole("button", { name: "重新載入待辦" }).click();
  await expect(page.getByText("目前有 1 項需要注意。")).toBeVisible();
  await expect(page.getByRole("button", { name: /已過期食品/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /3 天內扣款/ })).toHaveCount(0);

  await page.getByRole("button", { name: "查看完整儀表" }).click();
  await expect(page.getByRole("heading", { name: "食品管理統計" })).toBeVisible();
  await expect(page.getByText("載入媒體統計中…")).toBeVisible();
  await expect(page.getByText("需要關注", { exact: true }).locator("..")).toHaveText(/需要關注\s*1$/);
  storageResponse.resolve();
  await expect(page.getByText("載入媒體統計中…")).toHaveCount(0);

  foods = [];
  await page.getByRole("button", { name: "精簡", exact: true }).click();
  await expect(page.getByText("目前沒有緊急項目。")).toBeVisible();
});
