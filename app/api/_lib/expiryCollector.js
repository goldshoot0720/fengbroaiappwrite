import { getCollectionId } from "./appwriteClient";
import { daysUntil } from "../../../lib/notifications/daysUntil";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";

const sdk = require("node-appwrite");

/**
 * @typedef {Object} RangeFilter
 * @property {'range'} mode
 * @property {number} [minDays]
 * @property {number} [maxDays]
 * @property {number} [limit]
 *
 * @typedef {Object} ExactFilter
 * @property {'exact'} mode
 * @property {number} [subscriptionDays]
 * @property {number} [foodDays]
 * @property {number} [limit]
 */

function inRange(days, minDays, maxDays) {
  return days != null && days >= minDays && days <= maxDays;
}

/**
 * Collect expiring items across all reminder modules with a shared query path.
 * 提醒窗口（含到期當天 0 天）：
 * - subscription 訂閱、trialpurchase 試用/首購、shoppinglist 購物清單：0~3 天
 * - food 食品：0~7 天
 * - quota 額度：非 AI quotaExpiry 0~3 天；AI expiryWeek/expiryMonth 只提醒 0~1 天
 * @param {import('node-appwrite').Databases} databases
 * @param {string} databaseId
 * @param {RangeFilter | ExactFilter} options
 */
export async function collectExpiryItems(databases, databaseId, options) {
  const limit = options.limit ?? 500;
  const mode = options.mode ?? "range";

  const subscriptions = [];
  const foods = [];
  const trialPurchases = [];
  const quotas = [];
  const shoppingItems = [];

  const matchSubscription = (days) => {
    if (days == null) return false;
    if (mode === "exact") {
      const exact = options.subscriptionDays ?? NOTIFICATION_POLICY.email.subscriptionExactDays;
      return days === exact;
    }
    const minDays = options.minDays ?? 0;
    const maxDays = options.maxDays ?? NOTIFICATION_POLICY.dashboardOs.subscriptionMaxDays;
    return days >= minDays && days <= maxDays;
  };

  const matchFood = (days) => {
    if (days == null) return false;
    if (mode === "exact") {
      const exact = options.foodDays ?? NOTIFICATION_POLICY.email.foodExactDays;
      return days === exact;
    }
    const minDays = options.minDays ?? 0;
    const maxDays = options.maxDays ?? NOTIFICATION_POLICY.dashboardOs.foodMaxDays;
    return days >= minDays && days <= maxDays;
  };

  // 管理模組表以「可選」方式處理：沒建表時略過，不讓整批通知失敗。
  const readCollection = async (name, attribute) => {
    try {
      const colId = await getCollectionId(databases, databaseId, name, { required: false });
      if (!colId) return [];
      const result = await databases.listDocuments(databaseId, colId, [
        sdk.Query.limit(limit),
        sdk.Query.orderAsc(attribute),
      ]);
      return result.documents;
    } catch {
      return [];
    }
  };

  try {
    const subColId = await getCollectionId(databases, databaseId, "subscription", {
      required: false,
    });
    if (subColId) {
      const subs = await databases.listDocuments(databaseId, subColId, [
        sdk.Query.limit(limit),
        sdk.Query.orderAsc("nextdate"),
      ]);
      for (const doc of subs.documents) {
        const days = daysUntil(doc.nextdate);
        if (!matchSubscription(days)) continue;
        subscriptions.push({
          id: doc.$id,
          name: doc.name || "未命名訂閱",
          daysLeft: days,
          nextdate: doc.nextdate,
          price: doc.price,
          currency: doc.currency || "TWD",
          account: doc.account || "",
          continue: doc.continue,
          note: doc.note || "",
        });
      }
    }
  } catch {
    // ignore subscription query errors
  }

  try {
    const foodColId = await getCollectionId(databases, databaseId, "food", {
      required: false,
    });
    if (foodColId) {
      const foodDocs = await databases.listDocuments(databaseId, foodColId, [
        sdk.Query.limit(limit),
        sdk.Query.orderAsc("todate"),
      ]);
      for (const doc of foodDocs.documents) {
        const days = daysUntil(doc.todate);
        if (!matchFood(days)) continue;
        foods.push({
          id: doc.$id,
          name: doc.name || "未命名食品",
          daysLeft: days,
          todate: doc.todate,
          amount: doc.amount,
        });
      }
    }
  } catch {
    // ignore food query errors
  }

  // 試用／首購：eventDate 0~3 天（固定窗口；exact 郵件通道不支援此表）
  if (mode !== "exact") {
    try {
      const docs = await readCollection("trialpurchase", "eventDate");
      for (const doc of docs) {
        const days = daysUntil(doc.eventDate);
        if (!inRange(days, 0, 3)) continue;
        trialPurchases.push({
          id: doc.$id,
          name: doc.name || "未命名試用",
          daysLeft: days,
          eventDate: doc.eventDate,
          account: doc.account || "",
        });
      }
    } catch {
      // ignore trialpurchase query errors
    }
  }

  // 額度：非 AI quotaExpiry 0~3 天；AI expiryWeek / expiryMonth 只提醒 0~1 天（固定窗口）
  if (mode !== "exact") {
    try {
      const docs = await readCollection("quota", "name");
      for (const doc of docs) {
        const isAi = String(doc.serviceType || "general") === "ai";
        const pushEntry = (kind, raw, label) => {
          if (!raw) return;
          const days = daysUntil(raw);
          const maxDays = isAi ? 1 : 3;
          if (!inRange(days, 0, maxDays)) return;
          quotas.push({
            id: doc.$id,
            name: doc.name || "未命名額度",
            daysLeft: days,
            kind,
            label,
            expiryDate: raw,
            account: doc.account || "",
            serviceType: isAi ? "ai" : "general",
          });
        };
        if (!isAi) {
          pushEntry("quotaExpiry", doc.quotaExpiry, "額度到期");
        } else {
          pushEntry("expiryWeek", doc.expiryWeek, "一週到期");
          pushEntry("expiryMonth", doc.expiryMonth, "一月到期");
        }
      }
    } catch {
      // ignore quota query errors
    }
  }

  // 購物清單：plannedDate 0~3 天（固定窗口）
  if (mode !== "exact") {
    try {
      const docs = await readCollection("shoppinglist", "plannedDate");
      for (const doc of docs) {
        const days = daysUntil(doc.plannedDate);
        if (!inRange(days, 0, 3)) continue;
        shoppingItems.push({
          id: doc.$id,
          name: doc.name || "未命名購物",
          daysLeft: days,
          plannedDate: doc.plannedDate,
          account: doc.account || "",
        });
      }
    } catch {
      // ignore shoppinglist query errors
    }
  }

  return { subscriptions, foods, trialPurchases, quotas, shoppingItems };
}
