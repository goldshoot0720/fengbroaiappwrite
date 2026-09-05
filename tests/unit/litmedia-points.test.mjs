import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findLitmediaAccount,
  isLitmediaServiceName,
  LITMEDIA_FRESH_WINDOW_MS,
  normalizeLitmediaKey,
  parseStreaksReport,
  resolveLitmediaKey,
  toLitmediaPointsFields,
} from "../../lib/litmediaPoints.ts";

// 取自 AutoSignLitVideo 的 litmedia-streaks-<runId> artifact
const artifact = {
  generatedAt: "2026-09-05T13:03:46.665Z",
  accountCount: 33,
  totalPoints: 9857,
  accounts: [
    {
      account: 1,
      label: "samafengtu-checkin (1)",
      status: "already_done",
      creditBalance: 365,
      finishedAt: "2026-09-05T12:56:28.999Z",
    },
    {
      account: 19,
      label: "goldshoot0720-checkin (19)",
      status: "checked_in",
      creditBalance: 140,
      finishedAt: "2026-09-05T12:58:02.000Z",
    },
    {
      account: 30,
      label: "account-30",
      status: "missing",
      creditBalance: null,
      finishedAt: null,
    },
  ],
};

describe("LitMedia points", () => {
  it("reads the balance and the moment it was measured", () => {
    const report = parseStreaksReport(artifact);
    assert.equal(report.generatedAt, "2026-09-05T13:03:46.665Z");
    assert.equal(report.accounts.length, 3);

    const entry = findLitmediaAccount(report, "19");
    assert.equal(entry?.creditBalance, 140);

    const fields = toLitmediaPointsFields(entry, report);
    // 時間必須是簽到當下，不是我們寫進資料庫的時間
    assert.deepEqual(fields, { quotaPoints: 140, pointsSyncedAt: "2026-09-05T12:58:02.000Z" });
  });

  it("matches a slot by number or by label, ignoring the -checkin suffix", () => {
    const report = parseStreaksReport(artifact);
    assert.equal(findLitmediaAccount(report, "1")?.account, 1);
    assert.equal(findLitmediaAccount(report, "goldshoot0720-checkin")?.account, 19);
    assert.equal(findLitmediaAccount(report, "GoldShoot0720")?.account, 19);
    assert.equal(findLitmediaAccount(report, "account-30")?.account, 30);
    assert.equal(findLitmediaAccount(report, ""), null);
    assert.equal(findLitmediaAccount(report, "99"), null);
    assert.equal(normalizeLitmediaKey("goldshoot0720-checkin (19)"), "goldshoot0720");
  });

  it("keeps the old number when this run reported no points", () => {
    const report = parseStreaksReport(artifact);
    const missing = findLitmediaAccount(report, "30");
    assert.equal(missing?.creditBalance, null);
    // null 代表「這次沒讀到」，覆蓋成 0 會謊報餘額用完
    assert.equal(toLitmediaPointsFields(missing, report), null);
    assert.equal(toLitmediaPointsFields(null, report), null);
  });

  it("falls back to the report time when an account has no finishedAt", () => {
    const report = parseStreaksReport({
      generatedAt: "2026-09-05T13:03:46.665Z",
      accounts: [{ account: 7, label: "a (7)", creditBalance: 12 }],
    });
    assert.deepEqual(toLitmediaPointsFields(findLitmediaAccount(report, "7"), report), {
      quotaPoints: 12,
      pointsSyncedAt: "2026-09-05T13:03:46.665Z",
    });
  });

  it("survives a malformed artifact instead of throwing", () => {
    assert.deepEqual(parseStreaksReport(null), { generatedAt: null, accounts: [] });
    assert.deepEqual(parseStreaksReport({ accounts: "nope" }), { generatedAt: null, accounts: [] });

    const partial = parseStreaksReport({ accounts: [{ creditBalance: "1,240", finishedAt: "bad" }] });
    assert.equal(partial.accounts[0].creditBalance, 1240);
    assert.equal(partial.accounts[0].finishedAt, null);
    // 沒有任何時間可標就不寫，寧可留白也不要標錯時間
    assert.equal(toLitmediaPointsFields(partial.accounts[0], partial), null);
  });

  it("matches a LitMedia row by its account, with no slot filled in", () => {
    const report = parseStreaksReport(artifact);
    // 額度列的帳號就叫 goldshoot0720，簽到槽位叫 goldshoot0720-checkin (19)
    const row = { name: "LitMedia", account: "goldshoot0720", litmediaAccount: "" };
    assert.equal(resolveLitmediaKey(row), "goldshoot0720");
    assert.equal(findLitmediaAccount(report, resolveLitmediaKey(row))?.account, 19);
  });

  it("lets an explicit slot win over the account", () => {
    assert.equal(
      resolveLitmediaKey({ name: "LitMedia", account: "goldshoot0720", litmediaAccount: "1" }),
      "1",
    );
  });

  it("leaves rows of other services alone", () => {
    // 不是 LitMedia 的服務就算帳號剛好同名也不碰，免得把點數寫到別人的列上
    assert.equal(resolveLitmediaKey({ name: "ChatGPT Plus", account: "goldshoot0720" }), "");
    assert.equal(resolveLitmediaKey({ name: "", account: "goldshoot0720" }), "");
    assert.equal(isLitmediaServiceName("LitVideo (LitMedia)"), true);
    assert.equal(isLitmediaServiceName("litmedia"), true);
    assert.equal(isLitmediaServiceName("ChatGPT"), false);
  });

  it("gives points a 33 minute freshness window", () => {
    assert.equal(LITMEDIA_FRESH_WINDOW_MS, 33 * 60 * 1000);
  });
});
