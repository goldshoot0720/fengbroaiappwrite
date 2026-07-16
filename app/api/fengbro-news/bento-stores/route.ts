import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const TRA_BENTO_STORE_SOURCE_URL =
  "https://www.railway.gov.tw/tra-tip-web/tip/tip004/tip421/storeLocation";

export type TraBentoStore = {
  name: string;
  detail: string;
  /** 桃園 / 中壢 等焦點站 */
  focus?: boolean;
  stationHint?: string;
};

/** Official page may fail; keep Taoyuan/Zhongli fallback from TRA listing. */
const FALLBACK_FOCUS_STORES: TraBentoStore[] = [
  {
    name: "桃園車站-臺鐵便當本舖桃園店",
    detail: "桃園車站2樓臨臺鐵售票口，(10:00~13:30,16:00~18:00)",
    focus: true,
    stationHint: "桃園",
  },
  {
    name: "中壢車站-臺鐵便當本舖中壢台",
    detail: "中壢車站2樓臨臺鐵剪票口(週一~週五營業)，(10:10~11:30,11:30~13:00)",
    focus: true,
    stationHint: "中壢",
  },
];

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function stationHintFromName(name: string): string | undefined {
  if (name.includes("桃園")) return "桃園";
  if (name.includes("中壢")) return "中壢";
  if (name.includes("板橋")) return "板橋";
  if (name.includes("臺北") || name.includes("台北")) return "臺北";
  return undefined;
}

function isFocusStore(name: string) {
  return /桃園|中壢/.test(name);
}

function parseStores(html: string): TraBentoStore[] {
  const stores: TraBentoStore[] = [];
  const re =
    /class="sublist-title"[^>]*>([\s\S]*?)<\/div>\s*<ol>([\s\S]*?)<\/ol>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const name = stripTags(m[1]);
    if (!name || !/便當|本舖|舖/.test(name)) continue;
    const lis = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
    const detail = lis.join("；") || name;
    stores.push({
      name,
      detail,
      focus: isFocusStore(name),
      stationHint: stationHintFromName(name),
    });
  }
  return stores;
}

export async function GET(request: NextRequest) {
  const focusOnly = new URL(request.url).searchParams.get("focus") !== "0";

  try {
    const res = await fetch(TRA_BENTO_STORE_SOURCE_URL, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "zh-TW,zh;q=0.9",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "follow",
    });
    const html = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    let stores = parseStores(html);
    if (stores.length === 0) {
      stores = FALLBACK_FOCUS_STORES.map((s) => ({ ...s }));
    }

    if (focusOnly) {
      const focused = stores.filter((s) => s.focus);
      stores = focused.length > 0 ? focused : FALLBACK_FOCUS_STORES.map((s) => ({ ...s }));
    }

    return NextResponse.json({
      sourceUrl: TRA_BENTO_STORE_SOURCE_URL,
      sourceLabel: "台鐵便當門市據點",
      focusOnly,
      fetchedAt: new Date().toISOString(),
      count: stores.length,
      stores,
      live: true,
    });
  } catch (error) {
    const stores = focusOnly
      ? FALLBACK_FOCUS_STORES.map((s) => ({ ...s }))
      : FALLBACK_FOCUS_STORES.map((s) => ({ ...s }));

    return NextResponse.json({
      sourceUrl: TRA_BENTO_STORE_SOURCE_URL,
      sourceLabel: "台鐵便當門市據點",
      focusOnly,
      fetchedAt: new Date().toISOString(),
      count: stores.length,
      stores,
      live: false,
      warning:
        error instanceof Error
          ? `無法即時讀取台鐵官網，已顯示備援據點：${error.message}`
          : "無法即時讀取台鐵官網，已顯示備援據點",
    });
  }
}
