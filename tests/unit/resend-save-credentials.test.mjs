import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function loadSettingsRoute(doc, writes) {
  const source = readFileSync(new URL("../../app/api/notification-settings/route.js", import.meta.url), "utf8");
  const dependencies = {
    "next/server": { NextResponse: Response },
    "../_lib/appwriteClient": { createAppwrite: () => ({ databaseId: "db", databases: {
      updateDocument: async (args) => writes.push(args),
      createDocument: async (args) => writes.push(args),
    } }) },
    "../_lib/notificationSettingsTable": {
      ensureNotificationSettingsCollection: async () => "settings",
      readSettingsDocument: async () => doc,
    },
    "../../../lib/notifications/notificationSettings": {
      NOTIFICATION_SETTINGS_DOCUMENT_ID: "settings", NOTIFICATION_SETTINGS_MAX_SLOTS: 21,
    },
    "../../../lib/notifications/passwordHash": {
      hashNotificationPassword: () => "hash", verifyNotificationPassword: (value) => value === "1234",
    },
  };
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", compiled)((id) => {
    assert.ok(dependencies[id], `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  return exports;
}

const apiKey = "re_test123456789";
const slots = [{ apiKey, toEmail: "test@example.com" }];
const request = (body) => new Request("https://example.com/api/notification-settings", {
  method: "PUT", body: JSON.stringify(body),
});

for (const existing of [false, true]) {
  test(`saved keys remain usable in Resend Authorization headers (${existing ? "update" : "first save"})`, async () => {
    const route = loadSettingsRoute(existing ? { passwordHash: "hash" } : null, []);
    const response = await route.PUT(request({ password: "1234", newPassword: "1234", slots }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    // The settings form applies these returned keys and remains unlocked after saving.
    assert.doesNotThrow(() => new Headers({ Authorization: `Bearer ${payload.slots[0].apiKey}` }));
    assert.equal(payload.slots[0].apiKey, apiKey);
  });
}

test("unauthenticated reads still mask stored keys", async () => {
  const route = loadSettingsRoute({ passwordHash: "hash", slotsJson: JSON.stringify(slots) }, []);
  const payload = await (await route.GET(new Request("https://example.com/api/notification-settings"))).json();
  assert.notEqual(payload.slots[0].apiKey, apiKey);
});

test("masked keys cannot overwrite stored credentials", async () => {
  const writes = [];
  const route = loadSettingsRoute({ passwordHash: "hash", slotsJson: JSON.stringify(slots) }, writes);
  const response = await route.PUT(request({ password: "1234", slots: [{ ...slots[0], apiKey: "re_••••••••6789" }] }));
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
});

test("wrong passwords cannot save or reveal keys", async () => {
  const writes = [];
  const route = loadSettingsRoute({ passwordHash: "hash", slotsJson: JSON.stringify(slots) }, writes);
  const response = await route.PUT(request({ password: "wrong", slots }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).slots, undefined);
  assert.equal(writes.length, 0);
});
