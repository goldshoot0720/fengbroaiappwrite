import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "缺少 url 參數" }, { status: 400 });
  }

  return NextResponse.json({
    url,
    title: "鋒兄比價（待接資料源）",
    source: "local",
    currency: "",
    currentPrice: null,
    history: [],
    resolvedAt: new Date().toISOString(),
    notice: "尚未接上實際比價資料源，/api/resolve 目前僅回傳佔位內容。",
  });
}
