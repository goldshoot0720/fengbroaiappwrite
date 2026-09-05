import assert from "node:assert/strict";
import test from "node:test";
import { isMindvideoImageService, mindvideoPointsForAccount } from "../../lib/mindvideoPoints.ts";

const row = { account: 30, name: "MINDVIDEO_TOKEN30", label: "goldshoot0720", status: "checked_in", remainingCredits: 900,
  gptImage2: { remaining: 93, used: 7, total: 100 }, finishedAt: "2026-09-05T19:35:00Z" };
test("MindVideo uses only the dedicated pool and exact account", () => {
  assert.equal(isMindvideoImageService("MindVideo/GPT Image 2"), true);
  assert.equal(isMindvideoImageService("MindVideo"), false);
  assert.deepEqual(mindvideoPointsForAccount({ rows: [row] }, "goldshoot0720"), {
    quotaPoints: 93, pointsSyncedAt: "2026-09-05T19:35:00.000Z",
  });
  assert.equal(mindvideoPointsForAccount({ rows: [row] }, "gold"), null);
  assert.equal(mindvideoPointsForAccount({ rows: [row, row] }, "30"), null);
});
test("missing or failed data never replaces the balance with zero", () => {
  for (const changed of [{ gptImage2: null }, { status: "failed" }, { gptImage2: { remaining: null } }, { gptImage2: { remaining: -1 } }]) {
    assert.equal(mindvideoPointsForAccount({ rows: [{ ...row, ...changed }] }, "30"), null);
  }
  assert.equal(mindvideoPointsForAccount({ rows: [{ ...row, gptImage2: { remaining: 0 } }] }, "30").quotaPoints, 0);
});
