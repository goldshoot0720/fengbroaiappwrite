import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { verifyAuth } from "../_lib/cronAuth";
import { collectExpiryItems } from "../_lib/expiryCollector";
import { getTaipeiDateKey } from "../../../lib/notifications/daysUntil";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";
import { RESEND_SLOT_COUNT } from "../../../lib/notifications/resendConfig";

export const dynamic = "force-dynamic";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function readBody(request) {
  if (request.method !== "POST") return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getResendConfig(searchParams, body = {}) {
  const from =
    body.resendFrom ||
    searchParams.get("_resendFrom") ||
    process.env.RESEND_FROM_EMAIL ||
    "FengBro <onboarding@resend.dev>";

  return Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const suffix = slot === 1 ? "" : String(slot);
    return {
      keyName: `RESEND_API_KEY${suffix}`,
      apiKey:
        body[`resendApiKey${suffix}`] ||
        searchParams.get(`_resendKey${suffix}`) ||
        process.env[`RESEND_API_KEY${suffix}`] ||
        "",
      to:
        body[`resendTo${suffix}`] ||
        searchParams.get(`_resendTo${suffix}`) ||
        process.env[`RESEND_TO_EMAIL${suffix}`] ||
        "",
      from,
    };
  }).filter((config) => config.apiKey || config.to);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return String(dateStr).slice(0, 10);
}

function formatRenewal(value) {
  if (value === false) return "不續訂";
  return "續訂中";
}

function buildEmail({ subscriptions, foods, todayKey }) {
  const subscriptionLines = subscriptions.map((item) => {
    const parts = [`- ${item.name}：${formatDate(item.nextdate)} 到期`];
    if (item.account) parts.push(`  帳號：${item.account}`);
    parts.push(`  續訂：${formatRenewal(item.continue)}`);
    if (item.note) parts.push(`  備註：${item.note}`);
    return parts.join("\n");
  });
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
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#172033">
      <h2 style="margin:0 0 12px">鋒兄到期提醒</h2>
      <p style="margin:0 0 16px;color:#64748b">檢查日期：${todayKey}</p>
      ${
        subscriptions.length
          ? `
        <h3 style="margin:20px 0 8px">訂閱：到期前一天</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">服務名稱</th>
              <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">帳號</th>
              <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">到期日</th>
              <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">是否續訂</th>
              <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">備註</th>
            </tr>
          </thead>
          <tbody>
            ${subscriptions
              .map((item) => {
                const renewalStyle =
                  item.continue === false
                    ? "color:#dc2626;font-weight:600"
                    : "color:#16a34a";
                return `<tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:8px 12px;font-weight:600">${item.name}</td>
                <td style="padding:8px 12px;color:#64748b">${item.account || "-"}</td>
                <td style="padding:8px 12px">${formatDate(item.nextdate)}</td>
                <td style="padding:8px 12px;${renewalStyle}">${formatRenewal(item.continue)}</td>
                <td style="padding:8px 12px;color:#64748b;max-width:200px">${item.note || "-"}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `
          : ""
      }
      ${
        foods.length
          ? `
        <h3 style="margin:20px 0 8px">食品：到期前一周</h3>
        <ul>${foods.map((item) => `<li><strong>${item.name}</strong>：${formatDate(item.todate)} 到期</li>`).join("")}</ul>
      `
          : ""
      }
    </div>
  `;

  return { subject: title, text, html };
}

async function sendResendEmail({ apiKey, from, to, subject, html, text, idempotencyKey }) {
  const recipients = String(to)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    const hasManualResendKey = Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
      const suffix = index === 0 ? "" : String(index + 1);
      return body[`resendApiKey${suffix}`];
    }).some(Boolean);
    const hasManualCredentials =
      request.method === "POST" && hasManualResendKey && body.appwriteApiKey;

    if (!hasManualCredentials && !verifyAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendConfigs = getResendConfig(searchParams, body);

    if (resendConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "RESEND_API_KEY / RESEND_TO_EMAIL is not configured",
        maxResendSlots: RESEND_SLOT_COUNT,
        configuredResendSlots: 0,
      });
    }

    const invalidConfig = resendConfigs.find((config) => !config.apiKey || !config.to);
    if (invalidConfig) {
      return NextResponse.json(
        {
          error: `${invalidConfig.keyName} requires both API key and recipient email`,
          maxResendSlots: RESEND_SLOT_COUNT,
          configuredResendSlots: resendConfigs.length,
        },
        { status: 400 }
      );
    }

    const invalidKey = resendConfigs.find((config) =>
      typeof config.apiKey !== "string" || /[^\x21-\x7E]/.test(config.apiKey)
    );
    if (invalidKey) {
      return NextResponse.json(
        { error: `${invalidKey.keyName} 含遮蔽符號或無效字元，請重新解鎖載入金鑰；若已儲存遮蔽值，請重新貼上完整 Resend API Key。` },
        { status: 400 }
      );
    }

    const { databases, databaseId } = createAppwrite(searchParams, body);
    const todayKey = getTaipeiDateKey();
    const { subscriptions, foods } = await collectExpiryItems(databases, databaseId, {
      mode: "exact",
      subscriptionDays: NOTIFICATION_POLICY.email.subscriptionExactDays,
      foodDays: NOTIFICATION_POLICY.email.foodExactDays,
      limit: 500,
    });

    if (subscriptions.length === 0 && foods.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        subscriptions: 0,
        foods: 0,
        maxResendSlots: RESEND_SLOT_COUNT,
        configuredResendSlots: resendConfigs.length,
        checkedAt: new Date().toISOString(),
      });
    }

    const email = buildEmail({ subscriptions, foods, todayKey });
    const resendResults = await Promise.all(
      resendConfigs.map((resend, index) =>
        sendResendEmail({
          ...resend,
          ...email,
          idempotencyKey: `fengbro-expiry-${todayKey}-${index + 1}`,
        })
      )
    );

    return NextResponse.json({
      success: true,
      sent: resendResults.length,
      resendIds: resendResults.map((result) => result?.id).filter(Boolean),
      subscriptions: subscriptions.length,
      foods: foods.length,
      maxResendSlots: RESEND_SLOT_COUNT,
      configuredResendSlots: resendConfigs.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("resend-expiry-notify error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Resend email notification failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handleResendExpiryNotify(request);
}

export async function POST(request) {
  return handleResendExpiryNotify(request);
}
