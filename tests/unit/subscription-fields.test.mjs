import assert from "node:assert/strict";
import test from "node:test";
import {
  SUBSCRIPTION_CSV_HEADERS,
  buildSubscriptionWritePayload,
  detectSubscriptionCsvMode,
  parseSubscriptionCsvRow,
  subscriptionFormToCsvValues,
  toSubscriptionForm,
} from "../../lib/subscriptionFields.ts";

test("subscription writes keep the long-lived eight-column schema", () => {
  const payload = buildSubscriptionWritePayload(
    {
      name: "Netflix",
      site: "https://netflix.com",
      price: 390,
      nextdate: "2026-09-01",
      note: "家庭方案",
      account: "feng",
      currency: "TWD",
      continue: true,
      category: "串流",
      archived: true,
    },
    "create"
  );

  assert.deepEqual(payload, {
    name: "Netflix",
    site: "https://netflix.com",
    price: 390,
    nextdate: "2026-09-01",
    note: "家庭方案",
    account: "feng",
    currency: "TWD",
    continue: true,
  });
});

test("CSV import and export use the eight long-lived columns", () => {
  assert.deepEqual(SUBSCRIPTION_CSV_HEADERS, ["name", "site", "price", "nextdate", "note", "account", "currency", "continue"]);
  assert.equal(detectSubscriptionCsvMode([...SUBSCRIPTION_CSV_HEADERS]), "full");
  assert.equal(detectSubscriptionCsvMode(["name", "price"]), null);

  const parsed = parseSubscriptionCsvRow(["iCloud", "", "90", "2026-09-01", "", "", "twd", "false"]);
  assert.equal(parsed.currency, "TWD");
  assert.equal(parsed.continue, false);
  assert.deepEqual(subscriptionFormToCsvValues(parsed), ["iCloud", "", 90, "2026-09-01", "", "", "TWD", false]);
});

test("existing subscriptions are normalised without organization fields", () => {
  const form = toSubscriptionForm({
    $id: "1",
    name: "ChatGPT",
    price: 20,
    nextdate: "2026-08-20T00:00:00.000Z",
  });

  assert.equal(form.nextdate, "2026-08-20");
  assert.equal(form.continue, true);
});
