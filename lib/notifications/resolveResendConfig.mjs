import { RESEND_SLOT_COUNT, RESEND_DEFAULT_FROM } from "./resendConfig.ts";

/** Resolve whole configurations, never mix credentials from different sources. */
export async function resolveResendConfig({ readSettings, body = {}, searchParams = new URLSearchParams(), env = process.env }) {
  const configsFrom = (source, from) => Array.from({ length: RESEND_SLOT_COUNT }, (_, index) => {
    const suffix = index === 0 ? "" : String(index + 1);
    return { keyName: `RESEND_API_KEY${suffix}`, apiKey: source("key", suffix) || "", to: source("to", suffix) || "", from };
  }).filter((slot) => slot.apiKey || slot.to);

  const manual = configsFrom((kind, suffix) => kind === "key"
    ? body[`resendApiKey${suffix}`] || searchParams.get(`_resendKey${suffix}`)
    : body[`resendTo${suffix}`] || searchParams.get(`_resendTo${suffix}`),
  body.resendFrom || searchParams.get("_resendFrom") || env.RESEND_FROM_EMAIL || RESEND_DEFAULT_FROM);
  if (manual.length) return { source: "manual", configs: manual };

  const doc = await readSettings();
  let slots = [];
  if (doc?.slotsJson) {
    try { slots = JSON.parse(doc.slotsJson); } catch { throw new Error("notificationsettings slotsJson 格式錯誤"); }
    if (!Array.isArray(slots) || slots.length > RESEND_SLOT_COUNT || slots.some((slot) =>
      !slot || typeof slot.apiKey !== "string" || typeof slot.toEmail !== "string")) {
      throw new Error("notificationsettings Resend 槽位格式錯誤");
    }
  }
  const stored = slots.map((slot, index) => ({
    keyName: `notificationsettings slot ${index + 1}`,
    apiKey: slot.apiKey.trim(), to: slot.toEmail.trim(),
    from: doc.fromEmail || env.RESEND_FROM_EMAIL || RESEND_DEFAULT_FROM,
  })).filter((slot) => slot.apiKey || slot.to);
  if (stored.length) return { source: "notificationsettings", configs: stored };

  return { source: "environment", configs: configsFrom((kind, suffix) =>
    env[`${kind === "key" ? "RESEND_API_KEY" : "RESEND_TO_EMAIL"}${suffix}`],
  env.RESEND_FROM_EMAIL || RESEND_DEFAULT_FROM) };
}

export function validateResendConfigs(configs) {
  for (const config of configs) {
    if (!config.apiKey || !config.to) throw new Error(`${config.keyName} requires both API key and recipient email`);
    if (typeof config.apiKey !== "string" || /[^\x21-\x7E]/.test(config.apiKey)) {
      throw new Error(`${config.keyName} 含遮蔽符號或無效字元，請重新儲存完整 Resend API Key。`);
    }
  }
}
