import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";
import { collectExpiryItems } from "../_lib/expiryCollector";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";
import { RESEND_SLOT_COUNT } from "../../../lib/notifications/resendConfig";
import { getTaipeiDateKey } from "../../../lib/notifications/daysUntil";

export const dynamic = "force-dynamic";

const sdk = require("node-appwrite");

function item(id, channel, label, status, detail) {
  return { id, channel, label, status, detail };
}

function countConfiguredResendSlots() {
  let count = 0;
  for (let slot = 1; slot <= RESEND_SLOT_COUNT; slot++) {
    const suffix = slot === 1 ? "" : String(slot);
    const apiKey = process.env[`RESEND_API_KEY${suffix}`] || "";
    const to = process.env[`RESEND_TO_EMAIL${suffix}`] || "";
    if (apiKey && to) count += 1;
  }
  return count;
}

async function readBody(request) {
  if (request.method === "GET") return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleSelfCheck(request) {
  const body = await readBody(request);
  const items = [];
  const meta = {
    timezone: NOTIFICATION_POLICY.timezone,
    todayTaipei: getTaipeiDateKey(),
    swVersion: NOTIFICATION_POLICY.swVersion,
    policy: {
      dashboardOsDays: NOTIFICATION_POLICY.dashboardOs.subscriptionMaxDays,
      pushWarnDays: NOTIFICATION_POLICY.pushAndSw.warnDays,
      emailSubExact: NOTIFICATION_POLICY.email.subscriptionExactDays,
      emailFoodExact: NOTIFICATION_POLICY.email.foodExactDays,
    },
  };

  const vapidPublic =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";

  items.push(
    item(
      "server.vapidPublic",
      "push",
      "VAPID 公鑰（伺服器）",
      vapidPublic ? "pass" : "fail",
      vapidPublic ? `已設定（長度 ${vapidPublic.length}）` : "缺少 VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY"
    )
  );
  items.push(
    item(
      "server.vapidPrivate",
      "push",
      "VAPID 私鑰（伺服器）",
      vapidPrivate ? "pass" : "fail",
      vapidPrivate ? "已設定（不顯示內容）" : "缺少 VAPID_PRIVATE_KEY（/api/push-send 無法送出）"
    )
  );

  const cronSecret = process.env.CRON_SECRET || "";
  items.push(
    item(
      "server.cronSecret",
      "server",
      "CRON_SECRET",
      cronSecret ? "pass" : "warn",
      cronSecret
        ? "已設定（Cron / 手動呼叫需 Bearer 或 ?secret=）"
        : "未設定：開發模式允許未驗證呼叫 push-send / resend（正式環境建議設定）"
    )
  );

  const resendSlots = countConfiguredResendSlots();
  items.push(
    item(
      "server.resend",
      "email",
      "Resend Email 環境變數",
      resendSlots > 0 ? "pass" : "warn",
      resendSlots > 0
        ? `已設定 ${resendSlots} 組 RESEND_API_KEY / RESEND_TO_EMAIL`
        : "部署環境未設定 RESEND（設定頁本機 localStorage 無法給 Cron 用）"
    )
  );

  // Appwrite: prefer request body (from Settings), else env/server defaults
  let appwriteOk = false;
  let pushSubCount = null;
  let expiryProbe = null;

  try {
    const { databases, databaseId } = createAppwrite(null, body);
    appwriteOk = true;
    items.push(
      item(
        "server.appwrite",
        "server",
        "Appwrite 連線設定",
        "pass",
        `databaseId 可用（…${String(databaseId).slice(-6)}）`
      )
    );

    try {
      const pushColId = await getCollectionId(databases, databaseId, "pushSubscriptions", {
        required: false,
      });
      if (!pushColId) {
        items.push(
          item(
            "server.pushCollection",
            "push",
            "pushSubscriptions 集合",
            "warn",
            "尚未建立（第一次訂閱推播時會自動建立）"
          )
        );
      } else {
        const docs = await databases.listDocuments(databaseId, pushColId, [
          sdk.Query.limit(1),
        ]);
        pushSubCount = typeof docs.total === "number" ? docs.total : docs.documents.length;
        items.push(
          item(
            "server.pushCollection",
            "push",
            "pushSubscriptions 集合",
            pushSubCount > 0 ? "pass" : "warn",
            pushSubCount > 0
              ? `已有約 ${pushSubCount} 筆推播訂閱`
              : "集合存在但尚無訂閱者"
          )
        );
      }
    } catch (err) {
      items.push(
        item(
          "server.pushCollection",
          "push",
          "pushSubscriptions 集合",
          "warn",
          err?.message || "無法查詢"
        )
      );
    }

    try {
      const { subscriptions, foods } = await collectExpiryItems(databases, databaseId, {
        mode: "range",
        minDays: 0,
        maxDays: NOTIFICATION_POLICY.pushAndSw.warnDays,
        limit: 100,
      });
      const exact = await collectExpiryItems(databases, databaseId, {
        mode: "exact",
        subscriptionDays: NOTIFICATION_POLICY.email.subscriptionExactDays,
        foodDays: NOTIFICATION_POLICY.email.foodExactDays,
        limit: 100,
      });
      expiryProbe = {
        range7: {
          subscriptions: subscriptions.length,
          foods: foods.length,
        },
        emailExact: {
          subscriptions: exact.subscriptions.length,
          foods: exact.foods.length,
        },
      };
      items.push(
        item(
          "server.expiryRange",
          "push",
          "到期掃描（Push/SW 0–7 天）",
          "pass",
          `訂閱 ${subscriptions.length} / 食品 ${foods.length}`
        )
      );
      items.push(
        item(
          "server.expiryExact",
          "email",
          "到期掃描（Email exact）",
          "pass",
          `訂閱前1天 ${exact.subscriptions.length} / 食品前7天 ${exact.foods.length}`
        )
      );
    } catch (err) {
      items.push(
        item(
          "server.expiry",
          "server",
          "到期掃描",
          "fail",
          err?.message || "collectExpiryItems 失敗"
        )
      );
    }
  } catch (err) {
    items.push(
      item(
        "server.appwrite",
        "server",
        "Appwrite 連線設定",
        "warn",
        err?.message ||
          "伺服器端無 Appwrite 設定。可從設定頁帶入本機憑證再測，或設定部署環境變數。"
      )
    );
  }

  items.push(
    item(
      "server.cronSchedule",
      "server",
      "Vercel Cron 排程",
      "info",
      "push-send 05:06 台灣 / resend-expiry-notify 05:16 台灣（見 vercel.json）"
    )
  );

  const summary = items.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, info: 0 }
  );
  let overall = "pass";
  if (summary.fail > 0) overall = "fail";
  else if (summary.warn > 0) overall = "warn";

  return NextResponse.json({
    success: true,
    overall,
    summary,
    items,
    meta,
    appwriteOk,
    pushSubCount,
    expiryProbe,
    checkedAt: new Date().toISOString(),
  });
}

export async function GET(request) {
  return handleSelfCheck(request);
}

export async function POST(request) {
  return handleSelfCheck(request);
}
