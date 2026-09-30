import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { DRIVE_SCOPE } from "../../../../lib/googleDrive";
import {
  GOOGLE_AUTH_URL,
  driveCallbackUrl,
  getGoogleClientSecret,
  resolveGoogleClientId,
} from "../../_lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gdrive_oauth_state";

/**
 * GET /api/google-drive/authorize?secret=<CRON_SECRET>
 * 一次性授權：導向 Google 同意畫面，取得離線用的 refresh token，
 * 讓每日排程不必開瀏覽器也能上傳到雲端硬碟。
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const { searchParams, origin } = new URL(request.url);
  if (!secret) {
    return NextResponse.json({ error: "未設定 CRON_SECRET，授權入口已停用。" }, { status: 503 });
  }
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = await resolveGoogleClientId();
  if (!clientId || !getGoogleClientSecret()) {
    return NextResponse.json(
      { error: "請先設定 Google Client ID（鋒兄設定或環境變數）與 GOOGLE_CLIENT_SECRET。" },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: driveCallbackUrl(origin),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    // Without prompt=consent Google omits the refresh token on a re-grant.
    prompt: "consent",
    state,
  }).toString();

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/google-drive",
    maxAge: 600,
  });
  return response;
}
