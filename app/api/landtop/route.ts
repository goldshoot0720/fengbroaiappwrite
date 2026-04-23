import { NextResponse } from "next/server";
import { fetchLandtopCatalog } from "@/app/api/_lib/landtop";
import { loadLandtopHistories, persistLandtopSnapshots } from "@/app/api/_lib/landtopHistory";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const refresh = searchParams.get("refresh") === "1";

    const result = await fetchLandtopCatalog({ query, refresh });
    const [snapshotResult, historyResult] = await Promise.all([
      persistLandtopSnapshots({ searchParams, products: result.products }),
      loadLandtopHistories({ searchParams, products: result.products }),
    ]);

    const warnings = [...(result.warnings || [])];

    if (historyResult.error) {
      warnings.push(`歷史價格讀取失敗：${historyResult.error}`);
    }

    if (snapshotResult.error) {
      warnings.push(`歷史價格寫入失敗：${snapshotResult.error}`);
    }

    return NextResponse.json({
      ...result,
      warnings,
      histories: historyResult.histories,
      historyAvailable: historyResult.available,
      snapshotStored: snapshotResult.stored || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "地標網通資料抓取失敗" },
      { status: 500 }
    );
  }
}
