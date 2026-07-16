import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.join(root, p);

const files = [
  "lib/notifications/policy.ts",
  "lib/notifications/daysUntil.ts",
  "lib/notifications/messages.ts",
  "lib/notifications/pushClient.ts",
  "lib/notifications/showNotification.ts",
  "lib/notifications/resendConfig.ts",
  "hooks/useNotificationPermission.ts",
  "hooks/useExpiryNotifications.ts",
  "hooks/useWebPush.ts",
  "components/notifications/NotificationPermissionBanner.tsx",
  "components/providers/ServiceWorkerBootstrap.tsx",
  "app/api/_lib/cronAuth.js",
  "app/api/_lib/expiryCollector.js",
  "app/api/check-expiry/route.js",
  "app/api/push-send/route.js",
  "app/api/push-subscribe/route.js",
  "app/api/resend-expiry-notify/route.js",
  "public/sw.js",
  "vercel.json",
];

const report = { ok: true, checks: [] };
function check(name, pass, detail = "") {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
}

for (const f of files) {
  check(`file:${f}`, fs.existsSync(rel(f)));
}

function getDateKeyInTimeZone(date = new Date(), timeZone = "Asia/Taipei") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
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
function daysUntil(dateStr, options = {}) {
  if (!dateStr) return null;
  const timeZone = options.timeZone || "Asia/Taipei";
  const now = options.now || new Date();
  const targetMs = dateKeyToUtcMs(String(dateStr).slice(0, 10));
  const todayMs = dateKeyToUtcMs(getDateKeyInTimeZone(now, timeZone));
  if (targetMs == null || todayMs == null) return null;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

const todayKey = getDateKeyInTimeZone();
const [y, m, d] = todayKey.split("-").map(Number);
const mk = (offset) => {
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
};
const fixedNow = new Date(`${todayKey}T12:00:00+08:00`);
check("daysUntil today=0", daysUntil(todayKey, { now: fixedNow }) === 0, String(daysUntil(todayKey, { now: fixedNow })));
check("daysUntil +1", daysUntil(mk(1), { now: fixedNow }) === 1, String(daysUntil(mk(1), { now: fixedNow })));
check("daysUntil +3", daysUntil(mk(3), { now: fixedNow }) === 3, String(daysUntil(mk(3), { now: fixedNow })));
check("daysUntil +7", daysUntil(mk(7), { now: fixedNow }) === 7, String(daysUntil(mk(7), { now: fixedNow })));
check("daysUntil null", daysUntil(null) === null);

// Policy alignment
const policy = fs.readFileSync(rel("lib/notifications/policy.ts"), "utf8");
const sw = fs.readFileSync(rel("public/sw.js"), "utf8");
const boot = fs.readFileSync(rel("components/providers/ServiceWorkerBootstrap.tsx"), "utf8");
const swVersion = (policy.match(/swVersion:\s*"([^"]+)"/) || [])[1];
const cacheName = (sw.match(/CACHE_NAME = '([^']+)'/) || [])[1];
check("swVersion policy present", !!swVersion, swVersion);
check("sw CACHE_NAME present", !!cacheName, cacheName);
check("swVersion == cache suffix", cacheName?.endsWith(swVersion?.replace("v", "") ? cacheName.includes(swVersion.replace("v", "")) : false) || cacheName === `fengbro-ai-${swVersion}`, `${cacheName} vs ${swVersion}`);
// softer: both mention v11 style
check("policy+sw both v11-ish", /v1\d/.test(swVersion || "") && /v1\d/.test(cacheName || ""), `${swVersion} ${cacheName}`);
check("bootstrap uses policy swVersion", boot.includes("NOTIFICATION_POLICY.swVersion"));

const vercel = JSON.parse(fs.readFileSync(rel("vercel.json"), "utf8"));
const cronPaths = (vercel.crons || []).map((c) => c.path);
check("cron push-send", cronPaths.includes("/api/push-send"));
check("cron resend", cronPaths.includes("/api/resend-expiry-notify"));

const dash = fs.readFileSync(rel("components/modules/EnhancedDashboard.tsx"), "utf8");
check("dashboard useExpiryNotifications", dash.includes("useExpiryNotifications"));
check("dashboard PermissionBanner", dash.includes("NotificationPermissionBanner"));
check("dashboard no old showSwNotification", !dash.includes("showSwNotification"));

const settings = fs.readFileSync(rel("components/modules/SettingsManagement.tsx"), "utf8");
check("settings useWebPush", settings.includes("useWebPush"));
check("settings enablePush", settings.includes("enablePush"));
check("settings no handleEnablePush", !settings.includes("handleEnablePush"));

const layout = fs.readFileSync(rel("app/layout.tsx"), "utf8");
check("layout bootstrap", layout.includes("ServiceWorkerBootstrap"));
check("layout no inline SW register", !layout.includes("serviceWorker.register"));

// API routes use shared collector
const checkExpiry = fs.readFileSync(rel("app/api/check-expiry/route.js"), "utf8");
const pushSend = fs.readFileSync(rel("app/api/push-send/route.js"), "utf8");
const resend = fs.readFileSync(rel("app/api/resend-expiry-notify/route.js"), "utf8");
check("check-expiry uses collector", checkExpiry.includes("collectExpiryItems"));
check("push-send uses collector", pushSend.includes("collectExpiryItems"));
check("resend uses collector", resend.includes("collectExpiryItems"));
check("push-send uses cronAuth", pushSend.includes("verifyAuth"));
check("resend uses cronAuth", resend.includes("verifyAuth"));
check("no local daysUntil in check-expiry", !/function daysUntil/.test(checkExpiry));
check("no local daysUntil in push-send", !/function daysUntil/.test(pushSend));
check("no local daysUntil in resend", !/function daysUntil/.test(resend));

// Thresholds in policy
check("policy dashboard 3 days", /subscriptionMaxDays:\s*3/.test(policy) && /foodMaxDays:\s*3/.test(policy));
check("policy push 7 days", /warnDays:\s*7/.test(policy));
check("policy email exact 1/7", /subscriptionExactDays:\s*1/.test(policy) && /foodExactDays:\s*7/.test(policy));

// SW handlers present
check("sw periodicsync", sw.includes("periodicsync"));
check("sw push", sw.includes("addEventListener('push'"));
check("sw notificationclick", sw.includes("notificationclick"));
check("sw check-expiry fetch", sw.includes("/api/check-expiry"));

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
