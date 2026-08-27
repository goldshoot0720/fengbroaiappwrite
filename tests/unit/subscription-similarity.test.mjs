import assert from "node:assert/strict";
import test from "node:test";
import {
  findSimilarSubscriptions,
  getSubscriptionSimilarityTerm,
  subscriptionContainsSimilarityTerm,
} from "../../lib/subscriptionSimilarity.ts";

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
