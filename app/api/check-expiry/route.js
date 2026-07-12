import { NextResponse } from "next/server";
import { getAppwriteErrorMessage, getAppwriteErrorStatus } from "../_lib/appwriteConfig";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

// GET /api/check-expiry - 供 Service Worker Periodic Sync 使用
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const WARN_DAYS = parseInt(searchParams.get('days') || '7');
    const expiringSubscriptions = [];
    const expiringFoods = [];

    // 查詢即將到期的訂閱
    try {
      const subColId = await getCollectionId(databases, databaseId, "subscription");
      if (subColId) {
        const subs = await databases.listDocuments(databaseId, subColId, [
          sdk.Query.limit(100),
          sdk.Query.orderAsc('nextdate'),
        ]);
        for (const doc of subs.documents) {
          const days = daysUntil(doc.nextdate);
          if (days !== null && days >= 0 && days <= WARN_DAYS) {
            expiringSubscriptions.push({
              id: doc.$id,
              name: doc.name,
              daysLeft: days,
              nextdate: doc.nextdate,
              price: doc.price,
              currency: doc.currency || 'TWD',
              account: doc.account || '',
              continue: doc.continue,
              note: doc.note || '',
            });
          }
        }
      }
    } catch (_) {
      // 忽略訂閱查詢錯誤
    }

    // 查詢即將過期的食品
    try {
      const foodColId = await getCollectionId(databases, databaseId, "food");
      if (foodColId) {
        const foods = await databases.listDocuments(databaseId, foodColId, [
          sdk.Query.limit(100),
          sdk.Query.orderAsc('todate'),
        ]);
        for (const doc of foods.documents) {
          const days = daysUntil(doc.todate);
          if (days !== null && days >= 0 && days <= WARN_DAYS) {
            expiringFoods.push({
              id: doc.$id,
              name: doc.name,
              daysLeft: days,
              todate: doc.todate,
              amount: doc.amount,
            });
          }
        }
      }
    } catch (_) {
      // 忽略食品查詢錯誤
    }

    return NextResponse.json({
      expiringSubscriptions,
      expiringFoods,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/check-expiry error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}
