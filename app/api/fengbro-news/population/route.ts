import { NextResponse } from "next/server";
import { loadPopulationStats, type PopulationStatsResult } from "@/lib/fengbroNews/population";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Simple process cache — population updates monthly. */
let cache: { at: number; data: PopulationStatsResult } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("refresh") === "1";
    const now = Date.now();
    if (!force && cache && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const data = await loadPopulationStats();
    if (!data.error) {
      cache = { at: now, data };
    }
    return NextResponse.json({ ...data, cached: false });
  } catch (err) {
    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        sourceLabel: "內政部戶政司開放資料",
        sourceUrl: "https://www.ris.gov.tw/app/portal/346",
        latestYyymm: "",
        regions: [],
        error: err instanceof Error ? err.message : "人口統計讀取失敗",
      } satisfies PopulationStatsResult,
      { status: 500 }
    );
  }
}
