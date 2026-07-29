import { NextRequest } from "next/server";
import { handleSearch } from "@/lib/fengbroNews/searchService";

export const dynamic = "force-dynamic";
/** Vercel / long server routes: allow multi-site scrape window */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleSearch(request, null);
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  return handleSearch(request, body);
}
