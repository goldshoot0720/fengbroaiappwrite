import { NextResponse } from "next/server";
import webpush from 'web-push';

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return { databases: new sdk.Databases(client), databaseId };
}

async function getCollectionId(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === name);
  if (!col) return null;
  return col.$id;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function verifyAuth(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode：未設定 secret 時允許

  // Vercel Cron 使用 Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // 手動測試使用 query param
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === cronSecret) return true;

  return false;
}

async function handlePushSend(request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(
    'mailto:admin@fengbro.app',
    vapidPublicKey,
    vapidPrivateKey
  );

  try {
    const { databases, databaseId } = createAppwrite();
    const WARN_DAYS = 7;
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
            expiringSubscriptions.push({ id: doc.$id, name: doc.name, daysLeft: days });
          }
        }
      }
    } catch (_) {}

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
            expiringFoods.push({ id: doc.$id, name: doc.name, daysLeft: days });
          }
        }
      }
    } catch (_) {}

    const totalItems = expiringSubscriptions.length + expiringFoods.length;
    if (totalItems === 0) {
      return NextResponse.json({ success: true, sent: 0, message: '無到期項目' });
    }

    // 組合通知內容
    const items = [
      ...expiringSubscriptions.map(s => ({ type: 'subscription', ...s })),
      ...expiringFoods.map(f => ({ type: 'food', ...f })),
    ];

    let title, body;
    if (totalItems === 1) {
      const item = items[0];
      const label = item.daysLeft === 0 ? '今天' : `${item.daysLeft} 天後`;
      if (item.type === 'subscription') {
        title = '📅 訂閱到期提醒';
        body = `${item.name} 將於 ${label} 到期`;
      } else {
        title = '🍱 食品過期提醒';
        body = `${item.name} 將於 ${label} 過期`;
      }
    } else {
      title = '⏰ 鋒兄到期提醒';
      body = `${totalItems} 個項目即將到期（${expiringSubscriptions.length} 訂閱 + ${expiringFoods.length} 食品）`;
    }

    const payload = JSON.stringify({ title, body, items, url: '/' });

    // 取得所有推播訂閱者
    const pushSubColId = await getCollectionId(databases, databaseId, "pushSubscriptions");
    if (!pushSubColId) {
      return NextResponse.json({ success: true, sent: 0, message: '無推播訂閱者' });
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
        // 410 Gone = 訂閱已失效，清理
        if (err.statusCode === 410) {
          toDelete.push(sub.$id);
        }
      }
    }

    // 清理失效訂閱
    for (const docId of toDelete) {
      try {
        await databases.deleteDocument(databaseId, pushSubColId, docId);
      } catch (_) {}
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
