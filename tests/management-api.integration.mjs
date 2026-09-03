import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startManagementFixture } from "./helpers/appwrite-management-fixture.mjs";

const baseUrl = process.env.MANAGEMENT_TEST_URL || "http://127.0.0.1:3000";
let fixture;

async function api(path, method = "GET", data, target = fixture) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries({ _endpoint: target.endpoint, _project: "fixture", _database: "fixture", _key: "fixture" })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const content = response.headers.get("content-type") || "";
  return { status: response.status, headers: response.headers, body: content.includes("json") ? await response.json() : await response.text() };
}

before(async () => { fixture = await startManagementFixture(); });
after(async () => { await fixture?.close(); });

describe("management routes against isolated Appwrite HTTP fixture", () => {
  it("loads all 33 service accounts and never caches personal records", async () => {
    const result = await api("/api/trial-purchase");
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.length, 33);
    assert.equal(result.body.at(-1).account, "account33@example.test");
    assert.match(result.headers.get("cache-control"), /no-store/);
  });

  it("paginates past 100 accounts", async () => {
    const large = await startManagementFixture({ accountCount: 133 });
    try {
      const result = await api("/api/trial-purchase", "GET", undefined, large);
      assert.equal(result.status, 200);
      assert.equal(result.body.length, 133);
    } finally { await large.close(); }
  });

  it("creates, edits all statuses/fields, clears the date, and deletes only the target account", async () => {
    const data = { name: "測試服務（示範資料）", account: "new@example.test", eventDate: "2026-10-01",
      firstPurchasePrice: 50, regularPrice: 200, note: "新增", trialStatus: "untried", purchaseStatus: "not_purchased" };
    const created = await api("/api/trial-purchase", "POST", data);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.$id;
    assert.equal(created.body.eventDate, "2026-10-01T00:00:00.000Z");
    const updated = await api(`/api/trial-purchase/${id}`, "PUT", { ...data, eventDate: "", note: "更新", trialStatus: "tried", purchaseStatus: "unavailable" });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.eventDate, null);
    assert.equal(updated.body.trialStatus, "tried");
    assert.equal(updated.body.purchaseStatus, "unavailable");
    const deleted = await api(`/api/trial-purchase/${id}`, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await api("/api/trial-purchase")).body.length, 33);
    assert.equal((await api(`/api/trial-purchase/${id}`, "DELETE")).status, 404);
  });

  it("rejects invalid fields before any Appwrite write", async () => {
    const beforeWrites = fixture.writes.length;
    for (const data of [null, [], { name: "" }, { name: "test", firstPurchasePrice: -1 },
      { name: "test", trialStatus: "invalid" }, { name: "test", eventDate: "2026-02-30" }]) {
      assert.equal((await api("/api/trial-purchase", "POST", data)).status, 400);
    }
    for (const data of [{ name: "test", system: "linux" }, { name: "test", site: "javascript:alert(1)" },
      { name: "test", licenseType: "paid_serial", serial: "x".repeat(501) },
      { name: "test", licenseType: "paid_serial", viewPassword: "x".repeat(101) },
      { name: "test", subscriptionSoftware: true, subscriptionPeriod: "一年" },
      { name: "test", subscriptionSoftware: true, subscriptionCurrency: "EUR" }]) {
      assert.equal((await api("/api/reinstall", "POST", data)).status, 400);
    }
    assert.equal(fixture.writes.length, beforeWrites);
  });

  it("persists reinstall fields, clears an old serial for no-license, and deletes", async () => {
    const data = { name: "測試軟體", system: "mac", softwareType: "paid", licenseType: "paid_serial",
      serial: "DEMO-KEY", viewPassword: "view-me", subscriptionSoftware: true, subscriptionPeriodCount: 1,
      subscriptionPeriodUnit: "year", subscriptionPrice: 990, subscriptionCurrency: "USD",
      site: "https://example.test/install", note: "測試" };
    const created = await api("/api/reinstall", "POST", data);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.serial, "DEMO-KEY");
    assert.equal(created.body.viewPassword, "view-me");
    assert.equal(created.body.subscriptionSoftware, true);
    assert.equal(created.body.subscriptionPeriod, "1年");
    assert.equal(created.body.subscriptionPrice, 990);
    assert.equal(created.body.subscriptionCurrency, "USD");
    const id = created.body.$id;
    const updated = await api(`/api/reinstall/${id}`, "PUT", { ...data, system: "win", softwareType: "free", licenseType: "none", site: "", subscriptionSoftware: false });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.serial, "");
    assert.equal(updated.body.viewPassword, "");
    assert.equal(updated.body.subscriptionSoftware, false);
    assert.equal(updated.body.subscriptionPeriod, "");
    assert.equal(updated.body.subscriptionPrice, 0);
    assert.equal(updated.body.site, null);
    assert.equal(updated.body.system, "win");
    assert.equal((await api(`/api/reinstall/${id}`, "DELETE")).status, 200);
    assert.equal((await api("/api/reinstall")).body.length, 3);
  });

  it("creates and edits AI/general quota fields, clears dates on general, and deletes only the target account", async () => {
    const data = { name: "測試額度服務", serviceType: "ai", account: "quota-new@example.test",
      quotaRemaining: 10, quotaRatio: 40, quotaExpiry: "2026-10-31",
      ratio5h: 90, expiry5h: "14:30", ratioWeek: 70, expiryWeek: "2026-11-15", ratioMonth: 30, expiryMonth: "2026-12-01",
      note: "AI 測試額度" };
    const created = await api("/api/quota", "POST", data);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.$id;
    assert.equal(created.body.quotaExpiry, "2026-10-31T00:00:00.000Z");
    assert.equal(created.body.expiry5h, "14:30");
    assert.equal(created.body.expiryWeek, "2026-11-15");
    assert.equal(created.body.expiryMonth, "2026-12-01");
    assert.equal(created.body.ratio5h, 90);

    const flipped = await api(`/api/quota/${id}`, "PUT", { ...data, serviceType: "general", ratio5h: 0, expiry5h: "", ratioWeek: 0, expiryWeek: "", ratioMonth: 0, expiryMonth: "", quotaExpiry: "" });
    assert.equal(flipped.status, 200, JSON.stringify(flipped.body));
    assert.equal(flipped.body.serviceType, "general");
    assert.equal(flipped.body.expiry5h, "");
    assert.equal(flipped.body.expiryWeek, "");
    assert.equal(flipped.body.expiryMonth, "");
    assert.equal(flipped.body.quotaExpiry, null);

    const deleted = await api(`/api/quota/${id}`, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await api("/api/quota")).body.length, 2);
    assert.equal((await api(`/api/quota/${id}`, "DELETE")).status, 404);
  });

  it("rejects invalid quota values before writing", async () => {
    const beforeWrites = fixture.writes.length;
    for (const data of [null, [], { name: "" },
      { name: "test", serviceType: "ai", ratio5h: -1 },
      { name: "test", serviceType: "ai", expiry5h: "中午" },
      { name: "test", serviceType: "ai", expiryWeek: "9/30" },
      { name: "test", serviceType: "ai", expiryMonth: "2026/12/01" },
      { name: "test", serviceType: "weird", quotaRemaining: 3 }]) {
      assert.equal((await api("/api/quota", "POST", data)).status, 400);
    }
    assert.equal(fixture.writes.length, beforeWrites);
  });

  it("creates/edits/deletes shopping items with planned date, currency, quantity and free-text pickup", async () => {
    const data = { name: "洗碗機（測試）", plannedDate: "2026-10-01", price: 12990, currency: "TWD",
      quantity: 1, shop: "PChome 測試", pickupMethod: "取貨付款", account: "buyer@example.test",
      note: "比價後決定" };
    const created = await api("/api/shopping-list", "POST", data);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.$id;
    assert.equal(created.body.plannedDate, "2026-10-01T00:00:00.000Z");
    assert.equal(created.body.price, 12990);
    assert.equal(created.body.quantity, 1);
    assert.equal(created.body.pickupMethod, "取貨付款");

    const updated = await api(`/api/shopping-list/${id}`, "PUT", {
      ...data, name: "洗碗機（改名）", currency: "JPY", price: 50000, quantity: 2,
      pickupMethod: "自行輸入：超商取貨", plannedDate: "", account: "other@example.test", note: "更動" });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.plannedDate, null);
    assert.equal(updated.body.currency, "JPY");
    assert.equal(updated.body.quantity, 2);
    assert.equal(updated.body.pickupMethod, "自行輸入：超商取貨");

    const deleted = await api(`/api/shopping-list/${id}`, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await api(`/api/shopping-list/${id}`, "DELETE")).status, 404);
  });

  it("rejects invalid shopping fields before writing", async () => {
    const beforeWrites = fixture.writes.length;
    for (const data of [null, [], { name: "" },
      { name: "test", quantity: 0 },
      { name: "test", price: -1 },
      { name: "test", currency: "EUR" },
      { name: "test", plannedDate: "2026-02-30" },
      { name: "test", pickupMethod: "x".repeat(101) }]) {
      assert.equal((await api("/api/shopping-list", "POST", data)).status, 400);
    }
    assert.equal(fixture.writes.length, beforeWrites);
  });

  it("does not use a similarly named table or another endpoint's cached collection", async () => {
    const other = await startManagementFixture({ seed: false });
    other.addCollection("trialpurchase_backup");
    try {
      const result = await api("/api/trial-purchase", "GET", undefined, other);
      assert.equal(result.status, 404);
      assert.match(result.body.error, /trialpurchase/);
    } finally { await other.close(); }
  });

  it("keeps permission errors distinct from a missing table", async () => {
    fixture.failWith(403);
    try {
      const result = await api("/api/reinstall");
      assert.equal(result.status, 403);
      assert.doesNotMatch(result.body.error, /不存在/);
    } finally { fixture.failWith(0); }
  });

  it("fails incomplete schemas without silently discarding fields", async () => {
    const collection = fixture.collections.get("reinstall");
    const attributes = collection.attributes;
    collection.attributes = attributes.filter((attr) => attr.key !== "serial");
    try {
      const result = await api("/api/reinstall", "POST", { name: "test", licenseType: "paid_serial", serial: "test" });
      assert.equal(result.status, 409);
      assert.match(result.body.error, /serial/);
    } finally { collection.attributes = attributes; }
  });

  it("creates both tables privately and repeated setup preserves every existing document", async () => {
    const empty = await startManagementFixture({ seed: false });
    try {
      for (const tableName of ["trialpurchase", "reinstall", "quota", "shoppinglist"]) {
        const result = await api("/api/create-table", "POST", { tableName }, empty);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.success, true);
        assert.deepEqual(empty.collections.get(tableName).$permissions, []);
        empty.addDocument(tableName, { name: "keep existing record" }, "keep-me");
        empty.collections.get(tableName).attributes.pop();
        const repeated = await api("/api/create-table", "POST", { tableName }, empty);
        assert.equal(repeated.status, 200);
        assert.equal(empty.documents.get(tableName)[0].$id, "keep-me");
      }
      assert.ok(empty.writes.every((write) => write.method !== "DELETE"));
    } finally { await empty.close(); }
  });

  it("reports SSE setup completion and schema failures honestly", async () => {
    const empty = await startManagementFixture({ seed: false });
    try {
      const result = await api("/api/create-table?table=trialpurchase", "GET", undefined, empty);
      assert.equal(result.status, 200);
      assert.match(result.body, /"type":"start"/);
      assert.match(result.body, /"type":"complete","success":true/);
      empty.failAttributes(true);
      const failed = await api("/api/create-table?table=reinstall", "GET", undefined, empty);
      assert.match(failed.body, /"type":"error"/);
      assert.doesNotMatch(failed.body, /"type":"complete"/);
    } finally { await empty.close(); }
  });
});
