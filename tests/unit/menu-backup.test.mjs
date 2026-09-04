import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MENU_BACKUP_ENTRIES,
  csvMenus,
  csvPathFor,
  extractFileStem,
  identifyBackupFile,
  zipMenus,
  zipPathFor,
} from "../../lib/menuBackup/catalog.ts";
import {
  buildFoodCsv,
  commonAccountCsvHeaders,
  parseFoodCsv,
  parseMusicMetaCsv,
} from "../../lib/menuBackup/simpleCsv.ts";

describe("menu backup catalog", () => {
  it("lists CSV menus without ZIP-only media menus", () => {
    const ids = csvMenus().map((entry) => entry.id);
    assert.ok(ids.includes("food"));
    assert.ok(ids.includes("subscription"));
    assert.ok(ids.includes("music"));
    assert.ok(ids.includes("videos"));
    assert.ok(!ids.includes("images"));
    assert.ok(!ids.includes("podcast"));
    assert.ok(!ids.includes("documents"));
    assert.ok(!ids.includes("notes"));
  });

  it("lists ZIP menus for media-bearing pages", () => {
    const ids = zipMenus().map((entry) => entry.id);
    assert.deepEqual(ids.sort(), ["documents", "images", "music", "notes", "podcast", "videos"].sort());
  });

  it("builds bundle paths under csv/ and zip/", () => {
    const food = MENU_BACKUP_ENTRIES.find((entry) => entry.id === "food");
    const images = MENU_BACKUP_ENTRIES.find((entry) => entry.id === "images");
    assert.equal(csvPathFor(food), "csv/food.csv");
    assert.equal(zipPathFor(images), "zip/images.zip");
  });

  it("identifies export filenames with nickname and date", () => {
    assert.deepEqual(identifyBackupFile("csv/food.csv"), { id: "food", kind: "csv" });
    assert.deepEqual(
      identifyBackupFile("appwrite-正式帳號-subscription-20260904.csv"),
      { id: "subscription", kind: "csv" },
    );
    assert.deepEqual(identifyBackupFile("appwrite-image.zip"), { id: "images", kind: "zip" });
    assert.deepEqual(identifyBackupFile("zip/videos.zip"), { id: "videos", kind: "zip" });
    assert.deepEqual(identifyBackupFile("appwrite-article.zip"), { id: "notes", kind: "zip" });
    assert.equal(identifyBackupFile("manifest.json"), null);
  });

  it("extracts stems from decorated export names", () => {
    assert.equal(extractFileStem("appwrite-food-20260904.csv"), "food");
    assert.equal(extractFileStem("appwrite-nickname-commonaccount-20260101.csv"), "nickname-commonaccount");
    assert.equal(identifyBackupFile("appwrite-nickname-commonaccount-20260101.csv")?.id, "common");
  });
});

describe("menu backup simple CSV", () => {
  it("round-trips food rows with quoted shops", () => {
    const csv = buildFoodCsv([
      {
        $id: "1",
        name: "牛奶",
        amount: 2,
        todate: "2026-09-10",
        photo: "",
        price: 89,
        shop: "全聯, 測試",
        photohash: "",
      },
    ]);
    const parsed = parseFoodCsv(`\uFEFF${csv}`);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data[0].name, "牛奶");
    assert.equal(parsed.data[0].shop, "全聯, 測試");
    assert.equal(parsed.data[0].amount, 2);
  });

  it("builds 75 common-account headers", () => {
    const headers = commonAccountCsvHeaders();
    assert.equal(headers.length, 75);
    assert.equal(headers[0], "name");
    assert.equal(headers[1], "site01");
    assert.equal(headers[2], "note01");
    assert.equal(headers[73], "site37");
    assert.equal(headers[74], "note37");
  });

  it("parses music metadata CSV", () => {
    const csv = "name,category,language,lyrics,note,ref\n歌名,流行,zh,\"第一行\n第二行\",備註,https://example.com";
    const parsed = parseMusicMetaCsv(csv);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data[0].name, "歌名");
    assert.match(parsed.data[0].lyrics, /第一行/);
  });
});
