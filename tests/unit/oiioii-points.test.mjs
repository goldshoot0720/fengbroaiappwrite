import assert from "node:assert/strict";
import { test } from "node:test";
import { findOiioiiAccount, isOiioiiService, parseOiioiiReport, toOiioiiPointsFields } from "../../lib/oiioiiPoints.ts";

const generatedAt = "2026-09-06T07:49:12.000Z";
const finishedAt = "2026-09-06T07:49:11.559Z";
const row = { account: 3, name: "goldshoot0720", status: "checked_in", currentPoints: 55, finishedAt };
const report = (entry = row) => parseOiioiiReport({ generatedAt, rows: [entry] });

test("OiiOii report matches account name or numeric slot and preserves measured time", () => {
  const data = report();
  assert.deepEqual(toOiioiiPointsFields(findOiioiiAccount(data, " GOLDSHOOT0720 "), data), {
    quotaPoints: 55, pointsSyncedAt: finishedAt,
  });
  assert.equal(findOiioiiAccount(data, "3"), data.accounts[0]);
  assert.equal(findOiioiiAccount(data, "goldshoot"), null);
  assert.equal(findOiioiiAccount(data, ""), null);
  assert.equal(findOiioiiAccount({ ...data, accounts: [...data.accounts, ...data.accounts] }, "3"), null);
});

test("missing or failed points never become zero; actual zero remains valid", () => {
  for (const currentPoints of [undefined, null, "", "55", -1, NaN, Infinity]) {
    const data = report({ ...row, currentPoints });
    assert.equal(toOiioiiPointsFields(data.accounts[0], data), null);
  }
  for (const status of ["failed", "skipped", null]) {
    const data = report({ ...row, status });
    assert.equal(toOiioiiPointsFields(data.accounts[0], data), null);
  }
  const zero = report({ ...row, currentPoints: 0 });
  assert.equal(toOiioiiPointsFields(zero.accounts[0], zero).quotaPoints, 0);
});

test("valid report timestamp is the only fallback; malformed reports are harmless", () => {
  const data = report({ ...row, finishedAt: "invalid" });
  assert.equal(toOiioiiPointsFields(data.accounts[0], data).pointsSyncedAt, generatedAt);
  assert.equal(toOiioiiPointsFields(data.accounts[0], { ...data, generatedAt: null }), null);
  assert.deepEqual(parseOiioiiReport(null), { generatedAt: null, accounts: [] });
  assert.equal(isOiioiiService(" OiiOii "), true);
  assert.equal(isOiioiiService("OiiOii.ai"), true);
  assert.equal(isOiioiiService("Other OiiOii"), false);
});
