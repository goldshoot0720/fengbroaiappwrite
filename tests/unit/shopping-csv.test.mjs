import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHOPPING_CSV_HEADERS,
  buildShoppingCsv,
  parseShoppingCsv,
  shoppingImportKey,
} from "../../lib/shoppingCsv.ts";

const sample = {
  $id: "doc1",
  name: "洗碗機",
  plannedDate: "2026-10-01T00:00:00.000Z",
  price: 12990,
  currency: "TWD",
  quantity: 1,
  shop: "PChome, 測試",
  pickupMethod: "門市購買",
  imageUrl: "https://example.com/dishwasher.jpg",
  account: "buyer@example.com",
  note: "比價後決定, 含逗號",
};

describe("shopping CSV", () => {
  it("exports the ten Appwrite fields and round-trips quoted notes", () => {
    assert.deepEqual(SHOPPING_CSV_HEADERS, [
      "name",
      "plannedDate",
      "price",
      "currency",
      "quantity",
      "shop",
      "pickupMethod",
      "imageUrl",
      "account",
      "note",
    ]);

    const csv = buildShoppingCsv([sample]);
    assert.match(csv, /^name,plannedDate,price,currency,quantity,shop,pickupMethod,imageUrl,account,note\n/);
    assert.match(csv, /"PChome, 測試"/);

    const { data, errors } = parseShoppingCsv(`\uFEFF${csv}`);
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "洗碗機",
        plannedDate: "2026-10-01",
        price: 12990,
        currency: "TWD",
        quantity: 1,
        shop: "PChome, 測試",
        pickupMethod: "門市購買",
        imageUrl: "https://example.com/dishwasher.jpg",
        account: "buyer@example.com",
        note: "比價後決定, 含逗號",
      },
    ]);
  });

  it("accepts Chinese headers and currency/pickup labels, and matches by name", () => {
    const csv = [
      "購物名稱,預定購買日,預定價格,幣別,預定數量,預定商店,取貨方式,圖片網址,帳號,備註",
      " 米 10kg ,2026/09/30,499,台幣,2,家樂福,宅配/郵寄,,owner@example.com,補貨",
      "鮮奶,2026.10.01,98,日圓,1,超市,超商取貨,https://example.com/milk.png,,試喝",
    ].join("\n");

    const { data, errors } = parseShoppingCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(data[0].name, "米 10kg");
    assert.equal(data[0].plannedDate, "2026-09-30");
    assert.equal(data[0].currency, "TWD");
    assert.equal(data[0].quantity, 2);
    assert.equal(data[0].pickupMethod, "宅配/郵寄");
    assert.equal(data[0].imageUrl, "");
    assert.equal(data[1].currency, "JPY");
    assert.equal(data[1].pickupMethod, "超商取貨");
    assert.equal(data[1].imageUrl, "https://example.com/milk.png");
    assert.equal(
      shoppingImportKey(data[0]),
      shoppingImportKey({ name: "米 10kg" }),
    );
  });

  it("skips invalid rows and requires a name", () => {
    const csv = [
      SHOPPING_CSV_HEADERS.join(","),
      ",2026-10-01,0,TWD,1,,,,",
      "商品,2026-02-30,0,TWD,1,,,,,",
      "商品,2026-10-01,-1,TWD,1,,,,,",
      "商品,2026-10-01,0,TWD,0,,,,,",
      "商品,2026-10-01,0,EUR,1,,,,,",
    ].join("\n");

    const { data, errors } = parseShoppingCsv(csv);
    assert.equal(data.length, 0);
    assert.ok(errors.some((error) => error.includes("name")));
    assert.ok(errors.some((error) => error.includes("預定購買日")));
    assert.ok(errors.some((error) => error.includes("價格")));
    assert.ok(errors.some((error) => error.includes("數量")));
    assert.ok(errors.some((error) => error.includes("幣別")));
  });

  it("fills defaults when optional columns are omitted", () => {
    const { data, errors } = parseShoppingCsv("name\nNotion 訂閱備品");
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "Notion 訂閱備品",
        plannedDate: "",
        price: 0,
        currency: "TWD",
        quantity: 1,
        shop: "",
        pickupMethod: "",
        imageUrl: "",
        account: "",
        note: "",
      },
    ]);
  });
});
