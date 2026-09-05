/**
 * 鋒兄額度：ChatGPT session 解析與 Codex 用量正規化。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAccessTokenHint,
  buildStoredCredential,
  maskAccessToken,
  parseChatGptSession,
  readStoredCredential,
} from "../../lib/chatgptSession.ts";
import {
  describeWindow,
  getUsageTone,
  normalizeCodexUsage,
  normalizeResetCredits,
  toQuotaFields,
} from "../../lib/codexUsage.ts";
import { buildQuotaWritePayload } from "../../lib/managementRecords.ts";

/** 造一個帶 chatgpt_account_id claim 的假 JWT。 */
function makeJwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url").replace(/=+$/, "");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const ACCOUNT_ID = "8c4b1f2a-0000-4c1a-9b2e-abcdef123456";
const TOKEN = makeJwt({
  exp: Math.floor(Date.now() / 1000) + 3600,
  "https://api.openai.com/auth": { chatgpt_account_id: ACCOUNT_ID },
});

describe("chatgpt session 解析", () => {
  it("吃純 JWT 並從 claim 取出帳號 ID", () => {
    const parsed = parseChatGptSession(TOKEN);
    assert.equal(parsed.accessToken, TOKEN);
    assert.equal(parsed.accountId, ACCOUNT_ID);
  });

  it("吃整份 session.json，只留 accessToken 與帳號 ID", () => {
    const sessionJson = JSON.stringify({
      user: { id: "user-1", email: "someone@example.com" },
      expires: "2026-12-01T00:00:00.000Z",
      account: { id: ACCOUNT_ID, planType: "plus" },
      accessToken: TOKEN,
      sessionToken: "should-not-be-stored",
      authProvider: "auth0",
    });

    const parsed = parseChatGptSession(sessionJson);
    assert.equal(parsed.accessToken, TOKEN);
    assert.equal(parsed.accountId, ACCOUNT_ID);
    assert.equal(parsed.planType, "plus");

    const stored = buildStoredCredential(parsed);
    assert.ok(!stored.includes("should-not-be-stored"), "sessionToken 不可寫入資料庫");
    assert.deepEqual(readStoredCredential(stored), {
      accessToken: TOKEN,
      accountId: ACCOUNT_ID,
    });
  });

  it("無法解析時回傳 null", () => {
    assert.equal(parseChatGptSession(""), null);
    assert.equal(parseChatGptSession("not a token"), null);
    assert.equal(parseChatGptSession('{"user":{}}'), null);
  });

  it("遮罩只留頭尾 4 碼", () => {
    const masked = maskAccessToken(TOKEN);
    assert.ok(masked.startsWith(TOKEN.slice(0, 4)));
    assert.ok(masked.endsWith(TOKEN.slice(-4)));
    assert.ok(!masked.includes(TOKEN.slice(8, 20)));
    assert.equal(buildAccessTokenHint(TOKEN), TOKEN.slice(-4));
  });
});

describe("額度寫入 payload 的 accessToken 規則", () => {
  const base = { name: "ChatGPT Plus", serviceType: "ai", quotaRemaining: 0, quotaRatio: 0 };

  it("新增時寫入正規化後的憑證", () => {
    const payload = buildQuotaWritePayload({ ...base, accessToken: TOKEN }, "create");
    assert.deepEqual(readStoredCredential(payload.accessToken), {
      accessToken: TOKEN,
      accountId: ACCOUNT_ID,
    });
  });

  it("更新時留空代表不動既有 token", () => {
    const payload = buildQuotaWritePayload({ ...base, accessToken: "" }, "update");
    assert.equal("accessToken" in payload, false);
  });

  it("更新時必須明確要求才會清除", () => {
    const payload = buildQuotaWritePayload({ ...base, clearAccessToken: true }, "update");
    assert.equal(payload.accessToken, "");
  });

  it("非 AI 服務不保留憑證", () => {
    const payload = buildQuotaWritePayload(
      { ...base, serviceType: "general", accessToken: TOKEN },
      "create"
    );
    assert.equal(payload.accessToken, "");
  });
});

describe("Codex 用量正規化", () => {
  const now = Date.UTC(2026, 8, 5, 6, 0, 0);

  it("snake_case 回應：5 小時與每週視窗都算出剩餘百分比", () => {
    const snapshot = normalizeCodexUsage(
      {
        plan_type: "plus",
        rate_limit: {
          primary_window: {
            used_percent: 100,
            window_minutes: 300,
            resets_at: now / 1000 + 3600,
          },
          secondary_window: {
            used_percent: 47,
            window_minutes: 10080,
            resets_at: now / 1000 + 86400 * 6,
          },
        },
        credits: 0,
        rate_limit_reached_type: "primary",
      },
      "test",
      now
    );

    assert.equal(snapshot.planType, "plus");
    assert.equal(snapshot.windows.length, 2);

    const [primary, secondary] = snapshot.windows;
    assert.equal(primary.label, "5 小時使用情況限制");
    assert.equal(primary.remainingPercent, 0);
    assert.equal(primary.reached, true);
    assert.equal(primary.resetsAt, new Date(now + 3600 * 1000).toISOString());

    assert.equal(secondary.label, "每週用量上限");
    assert.equal(secondary.remainingPercent, 53);
    assert.equal(secondary.reached, false);

    assert.equal(snapshot.credits, 0);
    assert.equal(snapshot.rateLimitReachedType, "primary");
  });

  it("camelCase 與相對秒數也能解析", () => {
    const snapshot = normalizeCodexUsage(
      {
        rateLimit: {
          primaryWindow: { usedPercent: 25, windowDurationMins: 300, resetsInSeconds: 600 },
        },
      },
      "test",
      now
    );

    const [primary] = snapshot.windows;
    assert.equal(primary.remainingPercent, 75);
    assert.equal(primary.resetsAt, new Date(now + 600 * 1000).toISOString());
  });

  it("只給剩餘百分比時反推使用率", () => {
    const snapshot = normalizeCodexUsage(
      { rate_limit: { primary_window: { remaining_percent: 12 } } },
      "test",
      now
    );
    assert.equal(snapshot.windows[0].usedPercent, 88);
    assert.equal(snapshot.windows[0].remainingPercent, 12);
  });

  it("沒有可用視窗時回傳空陣列而不是丟錯", () => {
    assert.deepEqual(normalizeCodexUsage(null, "test", now).windows, []);
    assert.deepEqual(normalizeCodexUsage({ rate_limit: {} }, "test", now).windows, []);
  });

  it("額外的每模型限制也帶進來", () => {
    const snapshot = normalizeCodexUsage(
      {
        rate_limit: { primary_window: { used_percent: 10, window_minutes: 300 } },
        additional_rate_limits: [
          { name: "gpt-5.3-codex-spark", used_percent: 60, window_minutes: 10080 },
        ],
      },
      "test",
      now
    );

    assert.equal(snapshot.windows.length, 2);
    assert.equal(snapshot.windows[1].key, "gpt-5.3-codex-spark");
    assert.equal(snapshot.windows[1].remainingPercent, 40);
  });
});

describe("重設點數與視窗標題", () => {
  it("解析重設點數的餘額與到期時間", () => {
    const credits = normalizeResetCredits({
      balance: 1,
      expires_at: "2026-10-05T07:34:00.000Z",
    });
    assert.equal(credits.balance, 1);
    assert.equal(credits.expiresAt, "2026-10-05T07:34:00.000Z");
  });

  it("陣列格式取最早到期的一筆", () => {
    const credits = normalizeResetCredits({
      credits: [
        { balance: 1, expires_at: "2026-11-01T00:00:00.000Z" },
        { balance: 2, expires_at: "2026-10-05T07:34:00.000Z" },
      ],
    });
    assert.equal(credits.expiresAt, "2026-10-05T07:34:00.000Z");
  });

  it("視窗標題依長度決定", () => {
    assert.equal(describeWindow("primary", 300), "5 小時使用情況限制");
    assert.equal(describeWindow("secondary", 10080), "每週用量上限");
    assert.equal(describeWindow("primary", null), "5 小時使用情況限制");
  });

  it("剩餘百分比對應提示色調", () => {
    assert.equal(getUsageTone(0), "danger");
    assert.equal(getUsageTone(15), "warning");
    assert.equal(getUsageTone(53), "ok");
  });
});

describe("帶入鋒兄額度表單欄位", () => {
  it("5 小時給 HH:mm、一週給 YYYY-MM-DD，積分放剩餘次數", () => {
    // 用本地時間造重設時刻，確保欄位跟著使用者時區走
    const reset5h = new Date(2026, 8, 5, 17, 28, 0);
    const resetWeek = new Date(2026, 8, 11, 20, 51, 0);

    const snapshot = normalizeCodexUsage(
      {
        rate_limit: {
          primary_window: {
            used_percent: 100,
            window_minutes: 300,
            resets_at: reset5h.getTime() / 1000,
          },
          secondary_window: {
            used_percent: 47,
            window_minutes: 10080,
            resets_at: resetWeek.getTime() / 1000,
          },
        },
        credits: 0,
      },
      "test"
    );

    assert.deepEqual(toQuotaFields(snapshot), {
      ratio5h: 0,
      expiry5h: "17:28",
      ratioWeek: 53,
      expiryWeek: "2026-09-11",
      quotaRemaining: 0,
    });
  });

  it("沒有視窗資料時給安全預設值", () => {
    assert.deepEqual(toQuotaFields(normalizeCodexUsage({}, "test")), {
      ratio5h: 0,
      expiry5h: "",
      ratioWeek: 0,
      expiryWeek: "",
      quotaRemaining: 0,
    });
  });
});
