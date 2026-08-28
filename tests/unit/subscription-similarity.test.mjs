import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimilarSubscriptionMatches,
  findSimilarSubscriptions,
  getSubscriptionSimilarityTerm,
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
  assert.deepEqual(matches.get("note-match"), undefined);
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
