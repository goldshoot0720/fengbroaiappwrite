import type { Subscription } from "@/types";

type SubscriptionSimilarityRecord = Pick<Subscription, "$id" | "name" | "note">;

const COPY_SUFFIX_PATTERN = /\s*[（(]\s*(?:複製|copy)\s*[）)]\s*$/iu;

function normalizeSimilarityText(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Return the service keyword used to find related subscriptions. */
export function getSubscriptionSimilarityTerm(name?: string | null) {
  let term = (name || "").trim();
  while (COPY_SUFFIX_PATTERN.test(term)) {
    term = term.replace(COPY_SUFFIX_PATTERN, "").trim();
  }
  return term || (name || "").trim();
}

/** Match only the service name and note fields for the related-services action. */
export function subscriptionContainsSimilarityTerm(
  subscription: Pick<Subscription, "name" | "note">,
  term: string,
) {
  const normalizedTerm = normalizeSimilarityText(term);
  if (!normalizedTerm) return false;

  return [subscription.name, subscription.note].some((value) =>
    normalizeSimilarityText(value).includes(normalizedTerm),
  );
}

/** Find other active subscriptions whose service or note contains the same keyword. */
export function findSimilarSubscriptions(
  subscriptions: readonly SubscriptionSimilarityRecord[],
  subscription: SubscriptionSimilarityRecord,
) {
  const term = getSubscriptionSimilarityTerm(subscription.name);
  if (!term) return [];

  return subscriptions.filter(
    (candidate) =>
      candidate.$id !== subscription.$id &&
      subscriptionContainsSimilarityTerm(candidate, term),
  );
}
