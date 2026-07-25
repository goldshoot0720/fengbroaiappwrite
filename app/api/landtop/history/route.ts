import { NextResponse } from "next/server";
import {
  importLandtopHistoryRows,
  loadAllLandtopHistories,
} from "@/app/api/_lib/landtopHistory";

export const dynamic = "force-dynamic";

/** GET: export all phone price history rows (all models). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await loadAllLandtopHistories({ searchParams });

    if (result.error) {
      return NextResponse.json(
        { error: result.error, available: result.available, rows: [], histories: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      available: result.available,
      total: result.rows?.length ?? 0,
      rows: result.rows || [],
      histories: result.histories || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "歷史價格讀取失敗" },
      { status: 500 }
    );
  }
}

/** POST: import history rows (merge / upsert by day + productId). */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = (await request.json()) as { rows?: unknown };
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "沒有可匯入的資料列" }, { status: 400 });
    }

    const result = await importLandtopHistoryRows({ searchParams, rows });

    if (result.error && !result.imported) {
      return NextResponse.json(
        {
          error: result.error,
          available: result.available,
          imported: 0,
        },
        { status: result.available === false ? 503 : 500 }
      );
    }

    return NextResponse.json({
      available: result.available,
      imported: result.imported,
      created: result.created,
      updated: result.updated,
      warning: result.error || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "歷史價格匯入失敗" },
      { status: 500 }
    );
  }
}
