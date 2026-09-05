import { buildAccessTokenHint } from "../../../lib/chatgptSession";

/**
 * accessToken 是可直接呼叫 ChatGPT API 的憑證，額度 API 一律不回傳明文；
 * 只給「有沒有設定」與末 4 碼。明文需經 /api/quota/[id]/access-token 並通過四位數密碼。
 */
export function sanitizeQuotaRow(row) {
  const { accessToken, ...rest } = row || {};
  return {
    ...rest,
    hasAccessToken: Boolean(accessToken),
    accessTokenHint: buildAccessTokenHint(accessToken),
  };
}
