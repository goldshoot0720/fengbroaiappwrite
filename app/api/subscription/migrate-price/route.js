import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId, clearCollectionCache } from "../../_lib/appwriteClient";
import { stepIntegerToFloat } from "../../_lib/floatAttributeMigration";

export const dynamic = 'force-dynamic';

// 把 subscription.price 從 integer 升級成 float（例如 USD 10.5）。
// 每次呼叫推進一步，前端重複呼叫直到 status 為 done。
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "subscription");

    let result;
    try {
      result = await stepIntegerToFloat(databases, databaseId, collectionId, "price");
    } catch (stepErr) {
      // 另一個請求搶先建立 / 刪除了同一欄位：當作進行中，下一輪再看狀態。
      if (stepErr?.code !== 409 && stepErr?.code !== 404) throw stepErr;
      result = { status: "pending", step: "等待其他請求完成同一步驟" };
    }
    clearCollectionCache(databaseId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /subscription/migrate-price error:", err);
    const message = err instanceof Error ? err.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
