import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const subscriptionModulePath = path.join(root, "components/modules/SubscriptionManagement.tsx");

describe("subscription recent searches", () => {
  it("uses the shared search shell as its only recent-search owner", async () => {
    const source = await readFile(subscriptionModulePath, "utf8");

    assert.match(source, /recentSearchKey="subscription-management"/);
    assert.match(source, /legacyRecentSearchKeys=\{LEGACY_SUBSCRIPTION_RECENT_SEARCH_KEYS\}/);
    assert.doesNotMatch(source, /setRecentSearches/);
    assert.doesNotMatch(source, /addRecentSearch/);
    assert.doesNotMatch(source, /searchExtras=/);
  });
});
