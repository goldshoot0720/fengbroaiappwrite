import { buildAccessTokenHint, readStoredCredential } from "../../../lib/chatgptSession";
import { buildClaudeAccessTokenHint, readStoredClaudeCredential } from "../../../lib/claudeSession";
import { buildGrokAccessTokenHint, readStoredGrokCredential } from "../../../lib/grokSession";
import { buildCommandCodeAccessTokenHint, readStoredCommandCodeCredential } from "../../../lib/commandCodeSession";

/**
 * 判斷 accessToken 是哪一種來源，只回一個標籤（不含任何明文），讓畫面能決定要顯示哪些方案卡片
 * （例如 Grok 沒有 5 小時視窗，不該跟 ChatGPT/Claude 一樣顯示一張假的 100% 已用卡）。
 * 順序跟其他地方的憑證判斷一樣：先 Claude（唯一前綴），再 Grok（JSON 或 iss claim），
 * 接著 Command Code（auth.json），最後才當 ChatGPT（任何其他 JWT／session.json）。
 */
function detectAccessTokenProvider(accessToken) {
  if (!accessToken) return "";
  if (readStoredClaudeCredential(accessToken)) return "claude";
  if (readStoredGrokCredential(accessToken)) return "grok";
  if (readStoredCommandCodeCredential(accessToken)) return "command-code";
  if (readStoredCredential(accessToken)) return "chatgpt";
  return "";
}

/**
 * accessToken 是可直接呼叫 ChatGPT / Claude / Grok / Command Code API 的憑證，額度 API 一律不回傳明文；
 * 只給「有沒有設定」、末 4 碼與來源標籤。明文需經 /api/quota/[id]/access-token 並通過四位數密碼。
 */
export function sanitizeQuotaRow(row) {
  const { accessToken, ...rest } = row || {};
  return {
    ...rest,
    hasAccessToken: Boolean(accessToken),
    accessTokenHint:
      buildAccessTokenHint(accessToken) ||
      buildClaudeAccessTokenHint(accessToken) ||
      buildGrokAccessTokenHint(accessToken) ||
      buildCommandCodeAccessTokenHint(accessToken),
    accessTokenProvider: detectAccessTokenProvider(accessToken),
  };
}
