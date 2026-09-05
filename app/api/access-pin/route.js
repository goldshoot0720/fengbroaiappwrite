import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { readAccessPinState, setAccessPin } from "../_lib/accessPin";

export const dynamic = "force-dynamic";

function failure(error) {
  console.error("access-pin error:", error);
  const message = error instanceof Error ? error.message : "操作失敗";
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET /api/access-pin — 只回報有沒有設定過密碼，不回傳任何密碼內容
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    return NextResponse.json(await readAccessPinState(databases, databaseId));
  } catch (error) {
    return failure(error);
  }
}

// PUT /api/access-pin — 首次設定只需 newPin；之後變更需帶對舊的 pin
export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { databases, databaseId } = createAppwrite(searchParams, body);

    const result = await setAccessPin(databases, databaseId, {
      pin: body?.pin,
      newPin: body?.newPin,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, hasPin: true });
  } catch (error) {
    return failure(error);
  }
}
