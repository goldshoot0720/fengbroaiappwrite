import { NextResponse } from "next/server";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

const TAIPEI_TIME_ZONE = "Asia/Taipei";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function getTaipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateKeyToUtcMs(dateKey) {
  const [year, month, day] = String(dateKey).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const targetMs = dateKeyToUtcMs(String(dateStr).slice(0, 10));
  const todayMs = dateKeyToUtcMs(getTaipeiDateKey());
  if (targetMs == null || todayMs == null) return null;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

function createAppwrite(searchParams, body = {}) {
  const endpoint = body.endpoint || searchParams.get("_endpoint") || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = body.projectId || searchParams.get("_project") || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = body.databaseId || searchParams.get("_database") || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = body.appwriteApiKey || searchParams.get("_key") || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

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
  const col = allCollections.collections.find((collection) => collection.name === name);
  return col?.$id || null;
}

function verifyAuth(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const { searchParams } = new URL(request.url);
  return searchParams.get("secret") === cronSecret;
}

async function readBody(request) {
  if (request.method !== "POST") return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getResendConfig(searchParams, body = {}) {
  return {
    apiKey: body.resendApiKey || searchParams.get("_resendKey") || process.env.RESEND_API_KEY || "",
    to: body.resendTo || searchParams.get("_resendTo") || process.env.RESEND_TO_EMAIL || "",
    from:
      body.resendFrom ||
      searchParams.get("_resendFrom") ||
      process.env.RESEND_FROM_EMAIL ||
      "FengBro <onboarding@resend.dev>",
  };
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return String(dateStr).slice(0, 10);
}

function buildEmail({ subscriptions, foods, todayKey }) {
  const subscriptionLines = subscriptions.map((item) => `- ${item.name}：${formatDate(item.nextdate)} 到期`);
  const foodLines = foods.map((item) => `- ${item.name}：${formatDate(item.todate)} 到期`);
  const title = `鋒兄到期提醒 ${todayKey}`;
  const text = [
    "鋒兄到期提醒",
    "",
    subscriptions.length ? "訂閱：到期前一天" : "",
    ...subscriptionLines,
    "",
    foods.length ? "食品：到期前一周" : "",
    ...foodLines,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#172033">
      <h2 style="margin:0 0 12px">鋒兄到期提醒</h2>
      <p style="margin:0 0 16px;color:#64748b">檢查日期：${todayKey}</p>
      ${subscriptions.length ? `
        <h3 style="margin:20px 0 8px">訂閱：到期前一天</h3>
        <ul>${subscriptions.map((item) => `<li><strong>${item.name}</strong>：${formatDate(item.nextdate)} 到期</li>`).join("")}</ul>
      ` : ""}
      ${foods.length ? `
        <h3 style="margin:20px 0 8px">食品：到期前一周</h3>
        <ul>${foods.map((item) => `<li><strong>${item.name}</strong>：${formatDate(item.todate)} 到期</li>`).join("")}</ul>
      ` : ""}
    </div>
  `;

  return { subject: title, text, html };
}

async function collectExpiryItems(databases, databaseId) {
  const subscriptions = [];
  const foods = [];

  const subColId = await getCollectionId(databases, databaseId, "subscription");
  if (subColId) {
    const subs = await databases.listDocuments(databaseId, subColId, [
      sdk.Query.limit(500),
      sdk.Query.orderAsc("nextdate"),
    ]);
    for (const doc of subs.documents) {
      if (daysUntil(doc.nextdate) === 1) {
        subscriptions.push({ id: doc.$id, name: doc.name || "未命名訂閱", nextdate: doc.nextdate });
      }
    }
  }

  const foodColId = await getCollectionId(databases, databaseId, "food");
  if (foodColId) {
    const foodDocs = await databases.listDocuments(databaseId, foodColId, [
      sdk.Query.limit(500),
      sdk.Query.orderAsc("todate"),
    ]);
    for (const doc of foodDocs.documents) {
      if (daysUntil(doc.todate) === 7) {
        foods.push({ id: doc.$id, name: doc.name || "未命名食品", todate: doc.todate });
      }
    }
  }

  return { subscriptions, foods };
}

async function sendResendEmail({ apiKey, from, to, subject, html, text, idempotencyKey }) {
  const recipients = String(to).split(",").map((item) => item.trim()).filter(Boolean);
  if (!recipients.length) throw new Error("RESEND_TO_EMAIL is missing");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: recipients, subject, html, text }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Resend ${response.status}`);
  }
  return payload;
}

async function handleResendExpiryNotify(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await readBody(request);
    const hasManualCredentials = request.method === "POST" && body.resendApiKey && body.appwriteApiKey;

    if (!hasManualCredentials && !verifyAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resend = getResendConfig(searchParams, body);

    if (!resend.apiKey) {
      return NextResponse.json({ success: true, skipped: true, reason: "RESEND_API_KEY is not configured" });
    }

    const { databases, databaseId } = createAppwrite(searchParams, body);
    const todayKey = getTaipeiDateKey();
    const { subscriptions, foods } = await collectExpiryItems(databases, databaseId);

    if (subscriptions.length === 0 && foods.length === 0) {
      return NextResponse.json({ success: true, sent: 0, subscriptions: 0, foods: 0, checkedAt: new Date().toISOString() });
    }

    const email = buildEmail({ subscriptions, foods, todayKey });
    const resendResult = await sendResendEmail({
      ...resend,
      ...email,
      idempotencyKey: `fengbro-expiry-${todayKey}`,
    });

    return NextResponse.json({
      success: true,
      sent: 1,
      resendId: resendResult?.id,
      subscriptions: subscriptions.length,
      foods: foods.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("resend-expiry-notify error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Resend email notification failed" }, { status: 500 });
  }
}

export async function GET(request) {
  return handleResendExpiryNotify(request);
}

export async function POST(request) {
  return handleResendExpiryNotify(request);
}
