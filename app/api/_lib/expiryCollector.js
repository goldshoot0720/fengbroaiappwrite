import { getCollectionId } from "./appwriteClient";
import { daysUntil } from "../../../lib/notifications/daysUntil";
import { NOTIFICATION_POLICY } from "../../../lib/notifications/policy";
import { isActiveSubscription } from "../../../lib/subscriptionFields";

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

/**
 * Collect expiring subscriptions and foods with a shared query path.
 * @param {import('node-appwrite').Databases} databases
 * @param {string} databaseId
 * @param {RangeFilter | ExactFilter} options
 */
export async function collectExpiryItems(databases, databaseId, options) {
  const limit = options.limit ?? 500;
  const mode = options.mode ?? "range";

  const subscriptions = [];
  const foods = [];

  const matchSubscription = (days) => {
    if (days == null) return false;
    if (mode === "exact") {
      const exact =
        options.subscriptionDays ?? NOTIFICATION_POLICY.email.subscriptionExactDays;
      return days === exact;
    }
    const minDays = options.minDays ?? 0;
    const maxDays = options.maxDays ?? NOTIFICATION_POLICY.pushAndSw.warnDays;
    return days >= minDays && days <= maxDays;
  };

  const matchFood = (days) => {
    if (days == null) return false;
    if (mode === "exact") {
      const exact = options.foodDays ?? NOTIFICATION_POLICY.email.foodExactDays;
      return days === exact;
    }
    const minDays = options.minDays ?? 0;
    const maxDays = options.maxDays ?? NOTIFICATION_POLICY.pushAndSw.warnDays;
    return days >= minDays && days <= maxDays;
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
        if (!isActiveSubscription(doc)) continue;
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

  return { subscriptions, foods };
}
