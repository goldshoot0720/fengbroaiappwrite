import { NextResponse } from "next/server";
import { driveCallbackUrl, exchangeAuthorizationCode } from "../../_lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gdrive_oauth_state";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function page(title, body, status = 200) {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.6}
code,textarea{font-family:ui-monospace,monospace}textarea{width:100%;height:96px}</style></head>
<body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  const response = new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/google-drive" });
  return response;
}

/**
 * GET /api/google-drive/callback — Google 同意畫面導回這裡。
 * 只把 refresh token 顯示給完成授權的人，由本人貼到 Vercel 環境變數；
 * 不寫進 Appwrite（瀏覽器讀得到那把金鑰）。
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (searchParams.get("error")) {
    return page("授權未完成", `<p>Google 回傳：${escapeHtml(searchParams.get("error"))}</p>`, 400);
  }
  if (!expectedState || searchParams.get("state") !== expectedState) {
    return page("授權已失效", "<p>請從 <code>/api/google-drive/authorize?secret=…</code> 重新開始（10 分鐘內完成）。</p>", 400);
  }

  try {
    const tokens = await exchangeAuthorizationCode(searchParams.get("code") || "", driveCallbackUrl(origin));
    if (!tokens.refresh_token) {
      return page(
        "沒有取得 refresh token",
        '<p>請到 <a href="https://myaccount.google.com/permissions">Google 帳戶的第三方存取權</a> 移除這個 App 後，再重新授權一次。</p>',
        400,
      );
    }
    return page(
      "Google 雲端硬碟授權完成",
      `<p>把下面的值加到 Vercel 專案的環境變數 <code>GOOGLE_DRIVE_REFRESH_TOKEN</code>（Production），然後重新部署：</p>
<textarea readonly onclick="this.select()">${escapeHtml(tokens.refresh_token)}</textarea>
<p>這個值等同於雲端硬碟備份資料夾的存取權，請勿分享或貼到其他地方。關閉此頁後不會再顯示。</p>`,
    );
  } catch (error) {
    return page("授權失敗", `<p>${escapeHtml(error instanceof Error ? error.message : "未知錯誤")}</p>`, 500);
  }
}
