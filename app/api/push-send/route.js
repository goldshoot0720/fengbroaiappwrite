import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";
import { verifyAuth } from "../_lib/cronAuth";
import { collectExpiryItems } from "../_lib/expiryCollector";
import { aggregatePushSummary } from "../../../lib/notifications/messages";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

async function handlePushSend(request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails("mailto:admin@fengbro.app", vapidPublicKey, vapidPrivateKey);

  try {
    const { databases, databaseId } = createAppwrite();

    const { subscriptions, foods } = await collectExpiryItems(databases, databaseId, {
      mode: "range",
      minDays: 0,
      maxDays: NOTIFICATION_POLICY.pushAndSw.warnDays,
      limit: 100,
    });

    const totalItems = subscriptions.length + foods.length;
    if (totalItems === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "無到期項目" });
    }

    const summary = aggregatePushSummary({ subscriptions, foods });
    const payload = JSON.stringify({
      title: summary.title,
      body: summary.body,
      items: summary.items,
      url: "/",
    });

    const pushSubColId = await getCollectionId(databases, databaseId, "pushSubscriptions");
    if (!pushSubColId) {
      return NextResponse.json({ success: true, sent: 0, message: "無推播訂閱者" });
    }

    const pushSubs = await databases.listDocuments(databaseId, pushSubColId, [
      sdk.Query.limit(500),
    ]);

    let sent = 0;
    let failed = 0;
    const toDelete = [];

    for (const sub of pushSubs.documents) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410) {
          toDelete.push(sub.$id);
        }
      }
    }

    for (const docId of toDelete) {
      try {
        await databases.deleteDocument(databaseId, pushSubColId, docId);
      } catch {
        // ignore cleanup errors
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      deleted: toDelete.length,
      totalSubscribers: pushSubs.documents.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("push-send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  return handlePushSend(request);
}

export async function POST(request) {
  return handlePushSend(request);
}
