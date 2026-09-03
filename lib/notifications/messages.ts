export type ExpiryItemLike = {
  name: string;
  daysLeft?: number;
  daysRemaining?: number;
};

function resolveDays(item: ExpiryItemLike): number {
  if (typeof item.daysLeft === "number") return item.daysLeft;
  if (typeof item.daysRemaining === "number") return item.daysRemaining;
  return 0;
}

function dayLabel(days: number, unit: "到期" | "過期"): string {
  if (days === 0) return `今天${unit}！`;
  return `${days} 天後${unit}`;
}

export function subscriptionExpiringMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "📅 訂閱到期提醒",
    body: `${item.name} ${dayLabel(days, "到期")}`,
    tag: "subscription",
  };
}

export function foodExpiringMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "🍱 食品過期提醒",
    body: `${item.name} ${dayLabel(days, "過期")}`,
    tag: "food",
  };
}

export function foodExpiredMessage(item: ExpiryItemLike) {
  const days = Math.abs(resolveDays(item));
  return {
    title: "🍱 食品已過期",
    body: `${item.name} 已過期 ${days} 天`,
    tag: "expired",
  };
}

export function financeBreakthroughMessage(alert: {
  name: string;
  current?: number | null;
  threshold: number;
  currency?: string;
}) {
  const current =
    alert.current == null
      ? "--"
      : `${alert.current}${alert.currency ? ` ${alert.currency}` : ""}`;
  return {
    title: `${alert.name} 突破提醒`,
    body: `目前 ${current}，已突破 ${alert.threshold}`,
    tag: "finance",
  };
}

/** How many item lines to put in a multi-item push body (OS trays truncate long text). */
const PUSH_BODY_PREVIEW_LIMIT = 8;

type ExpiryItemKind = "subscription" | "food" | "trialPurchase" | "quota" | "shopping";

type TypedExpiryItem = ExpiryItemLike & {
  type: ExpiryItemKind;
  /** quota 額度到期欄位（一週到期／一月到期…） */
  label?: string;
};

function kindUnit(type: ExpiryItemKind): "到期" | "過期" {
  return type === "food" ? "過期" : "到期";
}

function formatTypedItemLine(item: TypedExpiryItem): string {
  const days = resolveDays(item);
  const suffix = item.type === "quota" && item.label ? `（${item.label}）` : "";
  return `${item.name}${suffix} ${dayLabel(days, kindUnit(item.type))}`;
}

/** Multi-line body: summary + soonest items first, then “…還有 N 項”. */
export function formatMultiItemPushBody(params: {
  subscriptions: ExpiryItemLike[];
  foods: ExpiryItemLike[];
  trialPurchases?: ExpiryItemLike[];
  quotas?: Array<ExpiryItemLike & { label?: string }>;
  shoppingItems?: ExpiryItemLike[];
  items: TypedExpiryItem[];
  previewLimit?: number;
}): string {
  const { subscriptions, foods, trialPurchases = [], quotas = [], shoppingItems = [] } = params;
  const limit = params.previewLimit ?? PUSH_BODY_PREVIEW_LIMIT;
  const totalItems = params.items.length;
  const counts = [
    subscriptions.length ? `${subscriptions.length} 訂閱` : null,
    foods.length ? `${foods.length} 食品` : null,
    trialPurchases.length ? `${trialPurchases.length} 試用/首購` : null,
    quotas.length ? `${quotas.length} 額度` : null,
    shoppingItems.length ? `${shoppingItems.length} 購物` : null,
  ].filter(Boolean);
  const summary = `${totalItems} 個項目即將到期（${counts.join(" + ")}）`;

  const sorted = [...params.items].sort((a, b) => resolveDays(a) - resolveDays(b));
  const preview = sorted.slice(0, limit).map(formatTypedItemLine);
  const remaining = sorted.length - preview.length;
  const more = remaining > 0 ? `…還有 ${remaining} 項` : null;

  return [summary, ...preview, more].filter(Boolean).join("\n");
}

function titleForSingle(item: TypedExpiryItem): string {
  switch (item.type) {
    case "food": return "🍱 食品過期提醒";
    case "subscription": return "📅 訂閱到期提醒";
    case "trialPurchase": return "🧪 試用／首購到期提醒";
    case "quota": return "🎯 額度到期提醒";
    case "shopping": return "🛒 購物清單提醒";
  }
}

export function aggregatePushSummary(params: {
  subscriptions: ExpiryItemLike[];
  foods: ExpiryItemLike[];
  trialPurchases?: ExpiryItemLike[];
  quotas?: Array<ExpiryItemLike & { label?: string }>;
  shoppingItems?: ExpiryItemLike[];
}) {
  const { subscriptions, foods, trialPurchases = [], quotas = [], shoppingItems = [] } = params;
  const totalItems = subscriptions.length + foods.length + trialPurchases.length + quotas.length + shoppingItems.length;
  if (totalItems === 0) {
    return { title: "⏰ 鋒兄到期提醒", body: "無到期項目", items: [] as TypedExpiryItem[] };
  }

  const items: TypedExpiryItem[] = [
    ...subscriptions.map((s) => ({ type: "subscription" as const, ...s })),
    ...foods.map((f) => ({ type: "food" as const, ...f })),
    ...trialPurchases.map((t) => ({ type: "trialPurchase" as const, ...t })),
    ...quotas.map((q) => ({ type: "quota" as const, ...q })),
    ...shoppingItems.map((s) => ({ type: "shopping" as const, ...s })),
  ];

  if (totalItems === 1) {
    const item = items[0];
    const days = resolveDays(item);
    const label = days === 0 ? "今天" : `${days} 天後`;
    const suffix = item.type === "quota" && item.label ? `（${item.label}）` : "";
    return {
      title: titleForSingle(item),
      body: `${item.name}${suffix} 將於 ${label} ${kindUnit(item.type)}`,
      items,
    };
  }

  return {
    title: "⏰ 鋒兄到期提醒",
    body: formatMultiItemPushBody({ subscriptions, foods, trialPurchases, quotas, shoppingItems, items }),
    items,
  };
}

/** Dashboard OS uses plainer titles (pre-refactor wording). */
export function dashboardOsSubscriptionMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "訂閱即將到期提醒",
    body: `${item.name} 將在 ${days} 天內到期`,
  };
}

export function dashboardOsFoodExpiringMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "食品即將過期提醒",
    body: `${item.name} 將在 ${days} 天內過期`,
  };
}

export function dashboardOsFoodExpiredMessage(item: ExpiryItemLike) {
  const days = Math.abs(resolveDays(item));
  return {
    title: "食品已過期",
    body: `${item.name} 已過期 ${days} 天`,
  };
}

export function dashboardOsTrialPurchaseMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "試用／首購到期提醒",
    body: `${item.name} ${days === 0 ? "今天到期" : `將在 ${days} 天內到期`}`,
  };
}

export function dashboardOsQuotaMessage(item: ExpiryItemLike & { label?: string }) {
  const days = resolveDays(item);
  const label = item.label ? `（${item.label}）` : "";
  return {
    title: "額度到期提醒",
    body: `${item.name}${label} ${days === 0 ? "今天到期" : `將在 ${days} 天內到期`}`,
  };
}

export function dashboardOsShoppingMessage(item: ExpiryItemLike) {
  const days = resolveDays(item);
  return {
    title: "購物清單提醒",
    body: `${item.name} ${days === 0 ? "今天預定購買" : `將在 ${days} 天內到達預定購買日`}`,
  };
}
