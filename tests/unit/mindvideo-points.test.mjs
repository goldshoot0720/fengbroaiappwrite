import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findMindvideoAccount,
  isMindvideoImageService,
  MINDVIDEO_FRESH_WINDOW_MS,
  normalizeMindvideoKey,
  parseMindvideoStreaksReport,
  toMindvideoPointsFields,
} from "../../lib/mindvideoPoints.ts";

// 取自 AutoSignMindVideo `results` 分支上的 streaks.json
const artifact = {
  generatedAt: "2026-09-05T19:53:01.222Z",
  accounts: [
    {
      account: 1,
      name: "MINDVIDEO_TOKEN1",
      label: "feng33feng35feng3",
      status: "already_done",
      totalCredits: 244,
      remainingCredits: 77,
      usedCredits: 167,
      gptImage2: { remaining: 0, used: 0, total: 0 },
      finishedAt: "2026-09-05T19:51:23.735Z",
    },
    {
      account: 30,
      name: "MINDVIDEO_TOKEN30",
      label: "goldshoot0720",
      status: "already_done",
      totalCredits: 360,
      remainingCredits: 93,
      usedCredits: 267,
      gptImage2: { remaining: 93, used: 7, total: 100 },
      finishedAt: "2026-09-05T19:52:34.950Z",
    },
    {
      account: 33,
      name: "MINDVIDEO_TOKEN33",
      label: "account-33",
      status: "skipped",
      totalCredits: null,
      remainingCredits: null,
      usedCredits: null,
      gptImage2: null,
      finishedAt: "2026-09-05T19:51:59.884Z",
    },
  ],
};

describe("MindVideo / GPT Image 2 points", () => {
  it("reads GPT Image 2's own pool, not the general MindVideo credits", () => {
    assert.equal(isMindvideoImageService("MindVideo/GPT Image 2"), true);
    assert.equal(isMindvideoImageService("MindVideo/gpt image 2"), true);
    assert.equal(isMindvideoImageService("MindVideo"), false);

    const report = parseMindvideoStreaksReport(artifact);
    assert.equal(report.generatedAt, "2026-09-05T19:53:01.222Z");
    assert.equal(report.accounts.length, 3);

    const entry = findMindvideoAccount(report, "30");
    assert.equal(entry?.gptImage2Remaining, 93);

    const fields = toMindvideoPointsFields(entry, report);
    // 時間必須是簽到當下，不是我們寫進資料庫的時間
    assert.deepEqual(fields, { quotaPoints: 93, pointsSyncedAt: "2026-09-05T19:52:34.950Z" });
  });

  it("matches a slot by number or by label", () => {
    const report = parseMindvideoStreaksReport(artifact);
    assert.equal(findMindvideoAccount(report, "1")?.account, 1);
    assert.equal(findMindvideoAccount(report, "goldshoot0720")?.account, 30);
    assert.equal(findMindvideoAccount(report, "GoldShoot0720")?.account, 30);
    assert.equal(findMindvideoAccount(report, ""), null);
    assert.equal(findMindvideoAccount(report, "99"), null);
    assert.equal(normalizeMindvideoKey(" GoldShoot0720 "), "goldshoot0720");
  });

  it("never replaces the balance with zero when this run had no usable points", () => {
    const report = parseMindvideoStreaksReport(artifact);

    // status skipped -> 別碰
    const skipped = findMindvideoAccount(report, "33");
    assert.equal(toMindvideoPointsFields(skipped, report), null);
    assert.equal(toMindvideoPointsFields(null, report), null);

    // 帳號 1 的確有 0 點（不是缺值），0 點要能寫回去
    const zero = findMindvideoAccount(report, "1");
    assert.deepEqual(toMindvideoPointsFields(zero, report), {
      quotaPoints: 0,
      pointsSyncedAt: "2026-09-05T19:51:23.735Z",
    });

    for (const changed of [
      { gptImage2: null },
      { status: "failed" },
      { gptImage2: { remaining: null } },
      { gptImage2: { remaining: -1 } },
    ]) {
      const broken = parseMindvideoStreaksReport({
        accounts: [{ account: 30, label: "goldshoot0720", status: "already_done", finishedAt: "2026-09-05T19:52:34.950Z", ...changed }],
      });
      assert.equal(toMindvideoPointsFields(findMindvideoAccount(broken, "30"), broken), null);
    }
  });

  it("falls back to the report time when an account has no finishedAt", () => {
    const report = parseMindvideoStreaksReport({
      generatedAt: "2026-09-05T19:53:01.222Z",
      accounts: [{ account: 7, label: "a", status: "checked_in", gptImage2: { remaining: 12 } }],
    });
    assert.deepEqual(toMindvideoPointsFields(findMindvideoAccount(report, "7"), report), {
      quotaPoints: 12,
      pointsSyncedAt: "2026-09-05T19:53:01.222Z",
    });
  });

  it("survives a malformed report instead of throwing", () => {
    assert.deepEqual(parseMindvideoStreaksReport(null), { generatedAt: null, accounts: [] });
    assert.deepEqual(parseMindvideoStreaksReport({ accounts: "nope" }), { generatedAt: null, accounts: [] });

    const partial = parseMindvideoStreaksReport({
      accounts: [{ status: "checked_in", gptImage2: { remaining: "1,240" }, finishedAt: "bad" }],
    });
    assert.equal(partial.accounts[0].gptImage2Remaining, 1240);
    assert.equal(partial.accounts[0].finishedAt, null);
    // 沒有任何時間可標就不寫，寧可留白也不要標錯時間
    assert.equal(toMindvideoPointsFields(partial.accounts[0], partial), null);
  });

  it("gives points a 33 minute freshness window, same reasoning as LitMedia", () => {
    assert.equal(MINDVIDEO_FRESH_WINDOW_MS, 33 * 60 * 1000);
  });
});
