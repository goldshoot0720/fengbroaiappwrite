import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLAUDE_USAGE_FRESH_WINDOW_MS,
  normalizeClaudeUsage,
  toClaudeQuotaFields,
} from "../../lib/claudeUsage.ts";
import {
  buildClaudeAccessTokenHint,
  looksLikeClaudeAccessToken,
  looksLikeClaudeRefreshToken,
  readStoredClaudeCredential,
  serializeClaudeCredential,
} from "../../lib/claudeSession.ts";

// 取自 https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202 的實測回應
const sampleUsage = {
  five_hour: { utilization: 33.0, resets_at: "2026-04-11T07:00:00.528743+00:00" },
  seven_day: { utilization: 13.0, resets_at: "2026-04-17T00:59:59.951713+00:00" },
  seven_day_opus: null,
  seven_day_sonnet: { utilization: 1.0, resets_at: "2026-04-16T03:00:00.951719+00:00" },
  extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, utilization: null },
};

describe("normalizeClaudeUsage", () => {
  it("解析 five_hour／seven_day 視窗，utilization 換算成剩餘比例", () => {
    const snapshot = normalizeClaudeUsage(sampleUsage, "https://api.anthropic.com/api/oauth/usage");

    const fiveHour = snapshot.windows.find((window) => window.key === "five_hour");
    assert.equal(fiveHour?.usedPercent, 33);
    assert.equal(fiveHour?.remainingPercent, 67);
    assert.equal(fiveHour?.resetsAt, "2026-04-11T07:00:00.528Z");
    assert.equal(fiveHour?.reached, false);

    const sevenDay = snapshot.windows.find((window) => window.key === "seven_day");
    assert.equal(sevenDay?.usedPercent, 13);
    assert.equal(sevenDay?.remainingPercent, 87);

    // seven_day_opus 是 null，不該生出一個假視窗
    assert.equal(
      snapshot.windows.some((window) => window.key === "seven_day_opus"),
      false
    );

    const sonnet = snapshot.windows.find((window) => window.key === "seven_day_sonnet");
    assert.equal(sonnet?.usedPercent, 1);

    assert.equal(snapshot.extraUsage?.enabled, false);
  });

  it("拿到怪東西不炸——沒有已知欄位就回空視窗陣列", () => {
    const snapshot = normalizeClaudeUsage({ unexpected: true }, "test");
    assert.deepEqual(snapshot.windows, []);
    assert.equal(snapshot.extraUsage, null);
  });

  it("100% 用完要標記 reached", () => {
    const snapshot = normalizeClaudeUsage(
      { five_hour: { utilization: 100, resets_at: "2026-01-01T00:00:00Z" } },
      "test"
    );
    assert.equal(snapshot.windows[0].reached, true);
    assert.equal(snapshot.windows[0].remainingPercent, 0);
  });
});

describe("toClaudeQuotaFields", () => {
  it("轉成鋒兄額度欄位：剩餘比例 + 台北時間到期", () => {
    const snapshot = normalizeClaudeUsage(sampleUsage, "test");
    const fields = toClaudeQuotaFields(snapshot);

    assert.equal(fields.ratio5h, 67);
    assert.equal(fields.ratioWeek, 87);
    // 兩個到期欄位都應該有值（格式見 codexUsage：HH:mm／YYYY-MM-DD）
    assert.match(fields.expiry5h, /^\d{2}:\d{2}$/);
    assert.match(fields.expiryWeek, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("只有分模型的週視窗時，取用量較高的那個當代表", () => {
    const snapshot = normalizeClaudeUsage(
      {
        seven_day_opus: { utilization: 80, resets_at: "2026-04-16T03:00:00Z" },
        seven_day_sonnet: { utilization: 10, resets_at: "2026-04-16T03:00:00Z" },
      },
      "test"
    );
    const fields = toClaudeQuotaFields(snapshot);
    assert.equal(fields.ratioWeek, 20); // 100 - 80
  });

  it("完全沒有視窗資料就回 0，不猜、不炸", () => {
    const fields = toClaudeQuotaFields(normalizeClaudeUsage({}, "test"));
    assert.equal(fields.ratio5h, 0);
    assert.equal(fields.expiry5h, "");
    assert.equal(fields.ratioWeek, 0);
    assert.equal(fields.expiryWeek, "");
  });
});

describe("claudeSession credential 解析", () => {
  const accessToken = "sk-ant-oat01-abc123";
  const refreshToken = "sk-ant-ort01-def456";

  it("辨識 access／refresh token 前綴", () => {
    assert.equal(looksLikeClaudeAccessToken(accessToken), true);
    assert.equal(looksLikeClaudeRefreshToken(refreshToken), true);
    assert.equal(looksLikeClaudeAccessToken("eyJhbGciOi.abc.def"), false);
  });

  it("吃得下整份 .credentials.json（帶 claudeAiOauth 外殼）", () => {
    const raw = JSON.stringify({
      claudeAiOauth: { accessToken, refreshToken, expiresAt: 1234567890123, scopes: ["user:inference"] },
    });
    const credential = readStoredClaudeCredential(raw);
    assert.equal(credential?.accessToken, accessToken);
    assert.equal(credential?.refreshToken, refreshToken);
    assert.equal(credential?.expiresAt, 1234567890123);
  });

  it("也吃得下精簡格式（沒有外殼）", () => {
    const raw = JSON.stringify({ accessToken, refreshToken, expiresAt: 1234567890123 });
    const credential = readStoredClaudeCredential(raw);
    assert.equal(credential?.accessToken, accessToken);
  });

  it("純 access token 字串也算數（只是沒有 refresh 能力）", () => {
    const credential = readStoredClaudeCredential(accessToken);
    assert.equal(credential?.accessToken, accessToken);
    assert.equal(credential?.refreshToken, undefined);
  });

  it("不是 Claude 格式（例如 ChatGPT 的 JWT／session.json）一律回 null", () => {
    assert.equal(readStoredClaudeCredential("eyJhbGciOi.abc.def"), null);
    assert.equal(readStoredClaudeCredential(JSON.stringify({ accessToken: "eyJhbGciOi.abc.def" })), null);
    assert.equal(readStoredClaudeCredential(""), null);
    assert.equal(readStoredClaudeCredential(null), null);
  });

  it("寫回格式只留三個欄位、末 4 碼提示正確", () => {
    const serialized = serializeClaudeCredential({ accessToken, refreshToken, expiresAt: 1234567890123 });
    const parsed = JSON.parse(serialized);
    assert.deepEqual(Object.keys(parsed).sort(), ["accessToken", "expiresAt", "refreshToken"]);
    assert.equal(buildClaudeAccessTokenHint(serialized), accessToken.slice(-4));
  });
});

describe("CLAUDE_USAGE_FRESH_WINDOW_MS", () => {
  it("高於社群回報的安全下限（180 秒），避免打太密被限流", () => {
    assert.ok(CLAUDE_USAGE_FRESH_WINDOW_MS > 180 * 1000);
  });
});
