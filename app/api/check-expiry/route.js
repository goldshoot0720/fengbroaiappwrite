import { NextResponse } from "next/server";
import { getAppwriteErrorMessage, getAppwriteErrorStatus } from "../_lib/appwriteConfig";
import { createAppwrite } from "../_lib/appwriteClient";
import { collectExpiryItems } from "../_lib/expiryCollector";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";

export const dynamic = "force-dynamic";

// GET /api/check-expiry — Service Worker Periodic Sync
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const warnDays = parseInt(
      searchParams.get("days") || String(NOTIFICATION_POLICY.pushAndSw.warnDays),
      10
    );

    const { subscriptions, foods } = await collectExpiryItems(databases, databaseId, {
      mode: "range",
      minDays: 0,
      maxDays: Number.isFinite(warnDays) ? warnDays : NOTIFICATION_POLICY.pushAndSw.warnDays,
      limit: 100,
    });

    return NextResponse.json({
      expiringSubscriptions: subscriptions,
      expiringFoods: foods,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/check-expiry error:", err);
    return NextResponse.json(
      { error: getAppwriteErrorMessage(err) },
      { status: getAppwriteErrorStatus(err) }
    );
  }
}
