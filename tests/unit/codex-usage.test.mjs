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
  formatCountdown,
  formatDateCountdown,
  getUsageTone,
  hasDateWindowReset,
  hasFiveHourWindowReset,
  isFiveHourResetPlausible,
  isUsageStale,
  normalizeCodexUsage,
  normalizeResetCredits,
  parseDateField,
  projectNextFiveHourReset,
  QUOTA_TIME_ZONE,
  resolveFiveHourReset,
  toQuotaFields,
  USAGE_FRESH_WINDOW_MS,
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
    // 用台北時間造重設時刻——欄位一律以台北為準，跟執行環境的時區無關
    const reset5h = new Date("2026-09-05T17:28:00+08:00");
    const resetWeek = new Date("2026-09-11T20:51:00+08:00");

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
      resetCreditsBalance: 0,
      resetCreditsExpiry: "",
    });
  });

  it("5 小時視窗還沒開始用就不寫重設時間", () => {
    // 沒用過的視窗，API 給的是整段長度（5 小時），換算出來只是「查詢時間 + 5 小時」，
    // 每同步一次就往後挪一次；存成 HH:mm 會看起來像個確定的時刻，跟 Codex CLI 永遠差一個同步間隔
    const snapshot = normalizeCodexUsage(
      {
        rate_limit: {
          primary_window: { used_percent: 0, window_minutes: 300, resets_in_seconds: 5 * 60 * 60 },
          secondary_window: {
            used_percent: 40,
            window_minutes: 10080,
            resets_at: new Date("2026-09-11T22:16:00+08:00").getTime() / 1000,
          },
        },
      },
      "test"
    );

    const fields = toQuotaFields(snapshot);
    assert.equal(fields.ratio5h, 100);
    assert.equal(fields.expiry5h, "");
    // 一週視窗有在用，重設時間照舊
    assert.equal(fields.expiryWeek, "2026-09-11");
  });

  it("5 小時視窗只要用過一點就照樣寫重設時間", () => {
    const snapshot = normalizeCodexUsage(
      {
        rate_limit: {
          primary_window: {
            used_percent: 0.4,
            window_minutes: 300,
            resets_at: new Date("2026-09-05T17:28:00+08:00").getTime() / 1000,
          },
        },
      },
      "test"
    );

    assert.equal(toQuotaFields(snapshot).expiry5h, "17:28");
  });

  it("沒有視窗資料時給安全預設值", () => {
    assert.deepEqual(toQuotaFields(normalizeCodexUsage({}, "test")), {
      ratio5h: 0,
      expiry5h: "",
      ratioWeek: 0,
      expiryWeek: "",
      quotaRemaining: 0,
      resetCreditsBalance: 0,
      resetCreditsExpiry: "",
    });
  });

  it("重置機會會一併帶入 resetCreditsBalance／resetCreditsExpiry", () => {
    const snapshot = normalizeCodexUsage({ rate_limit: {} }, "test");
    snapshot.resetCredits = { balance: 1, expiresAt: "2026-10-04T23:34:00.000Z" };
    const fields = toQuotaFields(snapshot);
    assert.equal(fields.resetCreditsBalance, 1);
    assert.equal(fields.resetCreditsExpiry, "2026-10-05 07:34");
  });
});

/**
 * 存進 Appwrite 的比例只是快照，畫面必須自己判斷「這份數字還算不算數」，
 * 否則 17:11 重設的視窗到了 19:51 還在標「已達使用上限」。
 */
describe("用量快照的新舊判斷", () => {
  const at = (text) => new Date(text).getTime();

  it("超過保鮮期才算過期，沒有時間戳一律當過期", () => {
    const now = at("2026-09-05T19:51:00+08:00");
    const fresh = new Date(now - 60_000).toISOString();
    const old = new Date(now - USAGE_FRESH_WINDOW_MS - 1000).toISOString();

    assert.equal(isUsageStale(fresh, now), false);
    assert.equal(isUsageStale(old, now), true);
    assert.equal(isUsageStale(undefined, now), true);
    assert.equal(isUsageStale("not a date", now), true);
  });

  it("HH:mm 靠同步時間還原成絕對時刻；同步後才到的時分算今天", () => {
    const syncedAt = at("2026-09-05T16:40:00+08:00");
    assert.equal(resolveFiveHourReset("17:11", syncedAt), at("2026-09-05T17:11:00+08:00"));
  });

  it("同步當下已經過了那個時分，往後找下一次出現的時分", () => {
    const syncedAt = at("2026-09-05T18:00:00+08:00");
    assert.equal(resolveFiveHourReset("17:11", syncedAt), at("2026-09-06T17:11:00+08:00"));
  });

  it("5 小時視窗的重設點不可能離同步時刻超過 5 小時", () => {
    const syncedAt = at("2026-09-05T20:33:00+08:00");
    // 時區換算錯的舊值：算出來要等 20 小時，明顯不是這個視窗的
    const wrong = resolveFiveHourReset("17:02", syncedAt);
    assert.equal(isFiveHourResetPlausible(wrong, syncedAt), false);

    const right = resolveFiveHourReset("01:02", syncedAt);
    assert.equal(right, at("2026-09-06T01:02:00+08:00"));
    assert.equal(isFiveHourResetPlausible(right, syncedAt), true);
  });

  it("對不上 5 小時上界就不給倒數，只標成不可信", () => {
    const syncedAt = at("2026-09-05T20:33:00+08:00");
    const projected = projectNextFiveHourReset("17:02", syncedAt, at("2026-09-05T20:35:00+08:00"));
    assert.equal(projected.reliable, false);
  });

  it("不知道同步時間就不猜", () => {
    assert.equal(resolveFiveHourReset("17:11", null), null);
    assert.equal(resolveFiveHourReset("", at("2026-09-05T16:40:00+08:00")), null);
  });

  it("重設時刻過了就認定視窗已重設", () => {
    const syncedAt = at("2026-09-05T16:40:00+08:00");
    assert.equal(hasFiveHourWindowReset("17:11", syncedAt, at("2026-09-05T17:00:00+08:00")), false);
    assert.equal(hasFiveHourWindowReset("17:11", syncedAt, at("2026-09-05T19:51:00+08:00")), true);
  });

  it("下次重設會往後推整數個 5 小時，並標記為估計值", () => {
    const syncedAt = at("2026-09-05T16:40:00+08:00");

    const before = projectNextFiveHourReset("17:11", syncedAt, at("2026-09-05T17:00:00+08:00"));
    assert.deepEqual(before, { at: at("2026-09-05T17:11:00+08:00"), projected: false, reliable: true });

    const after = projectNextFiveHourReset("17:11", syncedAt, at("2026-09-05T19:51:00+08:00"));
    assert.deepEqual(after, { at: at("2026-09-05T22:11:00+08:00"), projected: true, reliable: true });

    const muchLater = projectNextFiveHourReset("17:11", syncedAt, at("2026-09-06T04:00:00+08:00"));
    assert.deepEqual(muchLater, { at: at("2026-09-06T08:11:00+08:00"), projected: true, reliable: true });
  });

  it("一週／一月只到日，要跨過那天結束才敢說重設過", () => {
    assert.equal(hasDateWindowReset("2026-09-11", at("2026-09-11T23:00:00+08:00")), false);
    assert.equal(hasDateWindowReset("2026-09-11", at("2026-09-12T00:30:00+08:00")), true);
    assert.equal(hasDateWindowReset("", at("2026-09-12T00:30:00+08:00")), false);
    assert.equal(parseDateField("2026-09-11"), at("2026-09-11T00:00:00+08:00"));
    assert.equal(parseDateField("壞掉的日期"), null);
  });

  it("倒數只講到分", () => {
    const now = at("2026-09-05T19:51:00+08:00");
    assert.equal(formatCountdown(now + 12 * 60_000, now), "還有 12 分");
    assert.equal(formatCountdown(now + 140 * 60_000, now), "還有 2 小時 20 分");
    assert.equal(formatCountdown(now + 120 * 60_000, now), "還有 2 小時");
    assert.equal(formatCountdown(now - 60_000, now), "即將重設");
  });

  it("只有日期的視窗照日曆天數倒數", () => {
    // 9/6 中午看 9/11：毫秒差算到 9/11 00:00 只有 4 天多，會講成「還有 4 天」，
    // 但畫面同時寫著「9/11 重設」——欄位只存到日，就照日期數
    const now = at("2026-09-06T12:27:00+08:00");
    assert.equal(formatDateCountdown(parseDateField("2026-09-11"), now), "還有 5 天");
    assert.equal(formatDateCountdown(parseDateField("2026-09-07"), now), "明天重設");
    assert.equal(formatDateCountdown(parseDateField("2026-09-06"), now), "今天重設");
    assert.equal(formatDateCountdown(parseDateField("2026-09-05"), now), "今天重設");
  });
});

/**
 * 這兩個欄位存的是沒帶時區的牆上時鐘字串。瀏覽器算跟 Vercel（UTC）算若各憑本地時區，
 * 同一份用量會差 8 小時——所以一律釘在台北時間。
 */
describe("額度時間一律以台北時間為準", () => {
  const snapshot = normalizeCodexUsage(
    {
      rate_limits: {
        primary_window: {
          // 用過了才有真正的重設時刻可以換算時區（沒用過的視窗不寫時間，見上面的測試）
          used_percent: 12,
          window_minutes: 300,
          // 台北時間 2026-09-06 01:02
          resets_at: "2026-09-05T17:02:00Z",
        },
        secondary_window: {
          used_percent: 47,
          window_minutes: 60 * 24 * 7,
          // 台北時間 2026-09-11 07:30，UTC 還在 09-10
          resets_at: "2026-09-10T23:30:00Z",
        },
      },
    },
    "test",
  );

  it("不管執行環境在哪個時區都給台北的牆上時間", () => {
    assert.equal(QUOTA_TIME_ZONE, "Asia/Taipei");
    const fields = toQuotaFields(snapshot);
    assert.equal(fields.expiry5h, "01:02");
    assert.equal(fields.expiryWeek, "2026-09-11");
  });

  it("明確指定 UTC 就會看到差異，證明時區真的有生效", () => {
    const fields = toQuotaFields(snapshot, "UTC");
    assert.equal(fields.expiry5h, "17:02");
    assert.equal(fields.expiryWeek, "2026-09-10");
  });
});
