import assert from "node:assert/strict";
import test from "node:test";
import {
  activateSubscriptionSimilarityView,
  buildSimilarSubscriptionMatches,
  findSimilarSubscriptions,
  getSubscriptionSimilarityTerm,
  restoreSubscriptionSimilarityView,
  subscriptionContainsSimilarityTerm,
} from "../../lib/subscriptionSimilarity.ts";
import { subscriptionMatchesSearch } from "../../lib/subscriptionSearch.ts";

const subscription = (id, name, note = "") => ({ $id: id, name, note });

test("subscription similarity strips copy suffixes", () => {
  assert.equal(getSubscriptionSimilarityTerm("SuperGrok (複製)"), "SuperGrok");
  assert.equal(getSubscriptionSimilarityTerm("SuperGrok（複製）(複製)"), "SuperGrok");
});

test("subscription similarity checks service and note text", () => {
  assert.equal(subscriptionContainsSimilarityTerm(subscription("a", "SuperGrok Lite"), "supergrok"), true);
  assert.equal(subscriptionContainsSimilarityTerm(subscription("a", "其他服務", "SuperGrok 方案"), "SuperGrok"), true);
  assert.equal(subscriptionContainsSimilarityTerm(subscription("a", "其他服務"), "SuperGrok"), false);
});

test("findSimilarSubscriptions excludes the current record", () => {
  const current = subscription("copy", "SuperGrok (複製)", "中國信託");
  const records = [
    current,
    subscription("original", "SuperGrok"),
    subscription("note-match", "其他服務", "SuperGrok Lite"),
    subscription("unrelated", "ChatGPT"),
  ];

  assert.deepEqual(
    findSimilarSubscriptions(records, current).map((item) => item.$id),
    ["original", "note-match"],
  );
});

test("buildSimilarSubscriptionMatches keeps row summaries consistent", () => {
  const records = [
    subscription("copy", "SuperGrok (複製)"),
    subscription("original", "SuperGrok"),
    subscription("note-match", "其他服務", "SuperGrok Lite"),
  ];

  const matches = buildSimilarSubscriptionMatches(records);
  assert.deepEqual(matches.get("copy"), { term: "SuperGrok", count: 2 });
  assert.deepEqual(matches.get("original"), { term: "SuperGrok", count: 2 });
  assert.deepEqual(matches.get("note-match"), { term: "SuperGrok", count: 2 });
});

test("similarity is symmetric so shorter and longer names share one group", () => {
  const records = [
    subscription("psych-short", "身心科"),
    subscription("psych-dup", "身心科"),
    subscription("psych-outpatient", "身心科/門診"),
  ];

  const matches = buildSimilarSubscriptionMatches(records);
  assert.deepEqual(matches.get("psych-short"), { term: "身心科", count: 2 });
  assert.deepEqual(matches.get("psych-dup"), { term: "身心科", count: 2 });
  assert.deepEqual(matches.get("psych-outpatient"), { term: "身心科", count: 2 });
});

test("subscription search scopes similar-service results to name and note", () => {
  const record = {
    ...subscription("a", "其他服務", "沒有相關備註"),
    site: "https://supergrok.example",
    account: "supergrok-account",
    currency: "TWD",
  };

  assert.equal(subscriptionMatchesSearch(record, "SuperGrok"), true);
  assert.equal(subscriptionMatchesSearch(record, "SuperGrok", "service-note"), false);
  assert.equal(subscriptionMatchesSearch({ ...record, note: "SuperGrok 方案" }, "supergrok", "service-note"), true);
});

test("similarity view restores the exact filters, search, and selection it replaced", () => {
  const originalState = {
    searchQuery: "續訂",
    searchScope: "all",
    renewalFilter: "renewing",
    dueFilter: "7days",
    monthFilter: "2026-10",
    selectedIds: ["subscription-a", "subscription-b"],
  };

  const transition = activateSubscriptionSimilarityView(
    originalState,
    "subscription-supergrok",
    "SuperGrok",
  );

  assert.deepEqual(transition.nextState, {
    searchQuery: "SuperGrok",
    searchScope: "service-note",
    renewalFilter: "all",
    dueFilter: "all",
    monthFilter: "all",
    selectedIds: [],
  });
  assert.deepEqual(
    restoreSubscriptionSimilarityView(transition.activeView),
    originalState,
  );
  assert.notEqual(
    transition.activeView.restoreState.selectedIds,
    originalState.selectedIds,
  );
});

test("switching similarity buttons keeps the state from before similarity mode", () => {
  const originalState = {
    searchQuery: "",
    searchScope: "all",
    renewalFilter: "stopped",
    dueFilter: "nodate",
    monthFilter: "no-month",
    selectedIds: ["selected-before-similarity"],
  };
  const first = activateSubscriptionSimilarityView(
    originalState,
    "subscription-supergrok",
    "SuperGrok",
  );
  const second = activateSubscriptionSimilarityView(
    first.nextState,
    "subscription-chatgpt",
    "ChatGPT",
    first.activeView,
  );

  assert.equal(second.activeView.sourceSubscriptionId, "subscription-chatgpt");
  assert.equal(second.nextState.searchQuery, "ChatGPT");
  assert.deepEqual(
    restoreSubscriptionSimilarityView(second.activeView),
    originalState,
  );
});
