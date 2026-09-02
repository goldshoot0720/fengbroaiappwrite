import type { Subscription } from "@/types";
import type { SubscriptionSearchScope } from "@/lib/subscriptionSearch";

type SubscriptionSimilarityRecord = Pick<Subscription, "$id" | "name" | "note">;

export type SubscriptionSimilarityMatch = {
  term: string;
  count: number;
};

export type SubscriptionSimilarityViewState = {
  searchQuery: string;
  searchScope: SubscriptionSearchScope;
  renewalFilter: "all" | "renewing" | "stopped";
  dueFilter: "all" | "expired" | "7days" | "30days" | "nodate";
  monthFilter: string;
  selectedIds: readonly string[];
};

export type ActiveSubscriptionSimilarityView = {
  sourceSubscriptionId: string;
  term: string;
  restoreState: SubscriptionSimilarityViewState;
};

function cloneSimilarityViewState(
  state: SubscriptionSimilarityViewState,
): SubscriptionSimilarityViewState {
  return {
    ...state,
    selectedIds: [...state.selectedIds],
  };
}

/** Enter the temporary similarity view while retaining the state it replaced. */
export function activateSubscriptionSimilarityView(
  currentState: SubscriptionSimilarityViewState,
  sourceSubscriptionId: string,
  term: string,
  activeView?: ActiveSubscriptionSimilarityView | null,
) {
  const restoreState = cloneSimilarityViewState(
    activeView?.restoreState ?? currentState,
  );

  return {
    activeView: {
      sourceSubscriptionId,
      term,
      restoreState,
    } satisfies ActiveSubscriptionSimilarityView,
    nextState: {
      ...currentState,
      searchQuery: term,
      searchScope: "service-note" as const,
      renewalFilter: "all" as const,
      dueFilter: "all" as const,
      monthFilter: "all",
      selectedIds: [],
    } satisfies SubscriptionSimilarityViewState,
  };
}

/** Leave the similarity view and return an isolated copy of the prior state. */
export function restoreSubscriptionSimilarityView(
  activeView: ActiveSubscriptionSimilarityView,
) {
  return cloneSimilarityViewState(activeView.restoreState);
}

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

/**
 * Find other active subscriptions related to this one. The relation is
 * symmetric: a partner whose service or note contains this subscription's
 * keyword counts, and so does a partner whose keyword appears in this
 * subscription's own text, so short names such as 「身心科」 stay linked to
 * longer ones such as 「身心科/門診」.
 */
export function findSimilarSubscriptions(
  subscriptions: readonly SubscriptionSimilarityRecord[],
  subscription: SubscriptionSimilarityRecord,
) {
  const term = getSubscriptionSimilarityTerm(subscription.name);
  if (!term) return [];

  return subscriptions.filter((candidate) => {
    if (candidate.$id === subscription.$id) return false;
    if (subscriptionContainsSimilarityTerm(candidate, term)) return true;
    const candidateTerm = getSubscriptionSimilarityTerm(candidate.name);
    return (
      candidateTerm !== "" &&
      subscriptionContainsSimilarityTerm(subscription, candidateTerm)
    );
  });
}

/**
 * Pick the keyword that best explains a similarity group: prefer the term
 * (this subscription's own or a partner's) that is contained by the most
 * records, so the follow-up search lands on the whole group instead of a
 * single long-named record. Ties go to the shorter keyword.
 */
function pickSubscriptionSimilarityTerm(
  subscription: SubscriptionSimilarityRecord,
  similar: readonly SubscriptionSimilarityRecord[],
) {
  const ownTerm = getSubscriptionSimilarityTerm(subscription.name);
  const candidates = [
    ...new Set(
      [ownTerm, ...similar.map((item) => getSubscriptionSimilarityTerm(item.name))]
        .filter((term) => term && subscriptionContainsSimilarityTerm(subscription, term)),
    ),
  ];
  if (candidates.length === 0) return ownTerm;

  const rows = [subscription, ...similar];
  const coverage = (term: string) =>
    rows.filter((row) => subscriptionContainsSimilarityTerm(row, term)).length;

  return candidates.sort(
    (left, right) => coverage(right) - coverage(left) || left.length - right.length,
  )[0];
}

/** Build the per-row match summary used by the subscription list. */
export function buildSimilarSubscriptionMatches(
  subscriptions: readonly SubscriptionSimilarityRecord[],
) {
  const matches = new Map<string, SubscriptionSimilarityMatch>();

  subscriptions.forEach((subscription) => {
    const similar = findSimilarSubscriptions(subscriptions, subscription);
    if (similar.length === 0) return;

    matches.set(subscription.$id, {
      term: pickSubscriptionSimilarityTerm(subscription, similar),
      count: similar.length,
    });
  });

  return matches;
}
