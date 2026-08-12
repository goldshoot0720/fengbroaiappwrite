import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  SUBSCRIPTION_CSV_HEADERS,
  buildSubscriptionWritePayload,
  detectSubscriptionCsvMode,
  emptySubscriptionForm,
  isActiveSubscription,
  isBillableSubscription,
  isRenewingSubscription,
  parseSubscriptionCsvRow,
  subscriptionFormToCsvValues,
  toSubscriptionForm,
} from "../../lib/subscriptionFields.ts";

test("create payload omits empty organization fields", () => {
  const payload = buildSubscriptionWritePayload(
    {
      name: "Netflix",
      price: 390,
      currency: "TWD",
      continue: true,
      category: "",
      archived: false,
    },
    "create"
  );

  assert.deepEqual(payload, {
    name: "Netflix",
    price: 390,
    currency: "TWD",
    continue: true,
    archived: false,
  });
});

test("create payload keeps filled organization fields", () => {
  const payload = buildSubscriptionWritePayload(
    {
      name: "Spotify",
      price: 149,
      category: "串流",
      purpose: "娛樂",
      usageFrequency: "每天",
      friendliness: "很友善",
      alternative: "YouTube Music",
      retentionRecommendation: "續訂",
      archived: false,
    },
    "create"
  );

  assert.equal(payload.category, "串流");
  assert.equal(payload.purpose, "娛樂");
  assert.equal(payload.usageFrequency, "每天");
  assert.equal(payload.alternative, "YouTube Music");
  assert.equal(payload.retentionRecommendation, "續訂");
  assert.equal(payload.archived, false);
});

test("update payload can clear category and set archived", () => {
  const payload = buildSubscriptionWritePayload(
    {
      name: "Netflix",
      price: 390,
      category: "",
      archived: "true",
    },
    "update"
  );

  assert.equal(payload.category, "");
  assert.equal(payload.archived, true);
});

test("detects legacy and full CSV headers", () => {
  assert.equal(
    detectSubscriptionCsvMode(["name", "site", "price", "nextdate", "note", "account", "currency", "continue"]),
    "legacy"
  );
  assert.equal(detectSubscriptionCsvMode([...SUBSCRIPTION_CSV_HEADERS]), "full");
  assert.equal(detectSubscriptionCsvMode(["name", "price"]), null);
});

test("parses a 15-column CSV row including archived", () => {
  const row = parseSubscriptionCsvRow([
    "Netflix",
    "https://netflix.com",
    "390",
    "2026-09-01",
    "家庭方案",
    "feng",
    "twd",
    "true",
    "串流",
    "娛樂",
    "每天",
    "很友善",
    "Disney+",
    "觀察",
    "true",
  ]);

  assert.equal(row.category, "串流");
  assert.equal(row.retentionRecommendation, "觀察");
  assert.equal(row.archived, true);
  assert.equal(row.currency, "TWD");
});

test("round-trips form values through CSV helpers", () => {
  const form = {
    ...emptySubscriptionForm(),
    name: "iCloud",
    price: 90,
    category: "雲端",
    archived: true,
  };
  const values = subscriptionFormToCsvValues(form).map(String);
  const parsed = parseSubscriptionCsvRow(values);
  assert.equal(parsed.name, "iCloud");
  assert.equal(parsed.category, "雲端");
  assert.equal(parsed.archived, true);
});

test("treats missing or false archived as active for reminders", () => {
  assert.equal(isActiveSubscription(undefined), true);
  assert.equal(isActiveSubscription({}), true);
  assert.equal(isActiveSubscription({ archived: false }), true);
  assert.equal(isActiveSubscription({ archived: true }), false);
});

test("treats missing continue as renewing and false as stopped", () => {
  assert.equal(isRenewingSubscription(undefined), true);
  assert.equal(isRenewingSubscription({}), true);
  assert.equal(isRenewingSubscription({ continue: true }), true);
  assert.equal(isRenewingSubscription({ continue: false }), false);
});

test("billable subscriptions must be active and still renewing", () => {
  assert.equal(isBillableSubscription({}), true);
  assert.equal(isBillableSubscription({ archived: false, continue: true }), true);
  assert.equal(isBillableSubscription({ archived: true, continue: true }), false);
  assert.equal(isBillableSubscription({ archived: false, continue: false }), false);
  assert.equal(isBillableSubscription({ archived: true, continue: false }), false);
});

test("expiry collector and dashboard stats skip archived or stopped subscriptions", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const collector = await readFile(path.join(root, "app/api/_lib/expiryCollector.js"), "utf8");
  const dashboard = await readFile(path.join(root, "hooks/useDashboardStats.ts"), "utf8");
  const hook = await readFile(path.join(root, "hooks/useSubscriptions.ts"), "utf8");
  assert.match(collector, /isBillableSubscription\(doc\)/);
  assert.match(dashboard, /subsResult\.data\.filter\(isBillableSubscription\)/);
  assert.match(hook, /subscriptions\.filter\(isBillableSubscription\)/);
});

test("toSubscriptionForm keeps organization fields and formats the due date", () => {
  const form = toSubscriptionForm({
    $id: "1",
    name: "ChatGPT",
    price: 20,
    nextdate: "2026-08-20T00:00:00.000Z",
    category: "軟體",
    archived: true,
  });

  assert.equal(form.nextdate, "2026-08-20");
  assert.equal(form.category, "軟體");
  assert.equal(form.archived, true);
  assert.equal(form.continue, true);
});
