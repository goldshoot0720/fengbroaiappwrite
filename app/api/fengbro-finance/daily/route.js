import { NextResponse } from "next/server";
import { createAppwrite } from "../../_lib/appwriteClient";
import {
  ensureFinanceDailyCollection,
  readRecentSnapshots,
  writeSnapshot,
} from "../../_lib/financeDailyTable";
import { taipeiDateKey } from "../../../../lib/taipeiDate";
import { toDailyItem } from "../../../../lib/financeDaily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 指數最多也就二、三十檔，這個上限只是防止有人塞一整包資料進來。 */
const MAX_ITEMS = 80;
const MAX_ID_LENGTH = 80;
const MAX_NAME_LENGTH = 120;

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function failure(error) {
  console.error("finance daily error:", error);
  return json({ error: error instanceof Error ? error.message : "指數記錄失敗" }, 500);
}

async function context(request) {
  const { searchParams } = new URL(request.url);
  const { databases, databaseId } = createAppwrite(searchParams);
  const collectionId = await ensureFinanceDailyCollection(databases, databaseId);
  return { databases, databaseId, collectionId };
}

/** 今天的快照 vs 最近一次「不是今天」的快照。 */
function pickSnapshots(snapshots, todayKey) {
  const today = snapshots.find((snapshot) => snapshot.dateKey === todayKey) || null;
  const previous = snapshots.find((snapshot) => snapshot.dateKey < todayKey) || null;
  return { today, previous };
}

/** 只留欄位齊全、id 不重複的項目，並把長度收在合理範圍。 */
function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  const items = [];
  const seen = new Set();
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    const item = toDailyItem(entry || {});
    if (!item) continue;
    const id = item.id.slice(0, MAX_ID_LENGTH);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ ...item, id, name: item.name.slice(0, MAX_NAME_LENGTH) });
  }
  return items;
}

/**
 * GET /api/fengbro-finance/daily — 讀今天的記錄與上一次的記錄。
 * 沒有記錄時兩邊都是 null，畫面就不顯示「上次最高／最低」。
 */
export async function GET(request) {
  try {
    const { databases, databaseId, collectionId } = await context(request);
    const todayKey = taipeiDateKey();
    const snapshots = await readRecentSnapshots(databases, databaseId, collectionId, 4);
    return json(pickSnapshots(snapshots, todayKey));
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST /api/fengbro-finance/daily — 把今天看到的 52 週高低寫進記錄。
 *
 * 同一天重複呼叫只會覆蓋當天那一筆（documentId = YYYYMMDD），所以重新整理、
 * 手動更新都不會產生重複資料。回傳的 previous 一定是「今天以前」的那一筆。
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const items = normalizeItems(body?.items);
    if (items.length === 0) {
      return json({ error: "沒有可記錄的指數資料" }, 400);
    }

    const { databases, databaseId, collectionId } = await context(request);
    const todayKey = taipeiDateKey();

    // 先讀再寫：先寫的話，剛剛寫進去的那筆會被當成「上一次」。
    const snapshots = await readRecentSnapshots(databases, databaseId, collectionId, 4);
    const { previous } = pickSnapshots(snapshots, todayKey);

    await writeSnapshot(databases, databaseId, collectionId, { dateKey: todayKey, items });

    return json({ today: { dateKey: todayKey, items }, previous });
  } catch (error) {
    return failure(error);
  }
}
