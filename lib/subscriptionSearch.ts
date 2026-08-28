import type { Subscription } from "@/types";

export type SubscriptionSearchScope = "all" | "service-note";

type SubscriptionSearchRecord = Pick<
  Subscription,
  "$id" | "name" | "site" | "account" | "note" | "currency"
>;

function normalizeSearchText(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match a subscription against the visible search scope. */
export function subscriptionMatchesSearch(
  subscription: SubscriptionSearchRecord,
  query: string,
  scope: SubscriptionSearchScope = "all",
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const values = scope === "service-note"
    ? [subscription.name, subscription.note]
    : [subscription.$id, subscription.name, subscription.site, subscription.account, subscription.note, subscription.currency];

  return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}
