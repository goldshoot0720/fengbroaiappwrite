/**
 * Settings inventory for Appwrite collections that share a name.
 *
 * listCollections defaults to 25 rows, and a rebuild can leave two sitevisit
 * tables behind. The broken one often has the newer $updatedAt because a stuck
 * column keeps touching it, so "newest wins" keeps the 建立 button on the old id.
 */

export function userAttributes(collection) {
  return (collection?.attributes || []).filter(
    (attr) => attr && attr.key && !String(attr.key).startsWith("$"),
  );
}

function attributeState(attr) {
  if (!attr?.status || attr.status === "available") return "ready";
  if (attr.status === "failed" || attr.status === "stuck") return "failed";
  return "pending";
}

export function attributeHealth(collection) {
  const attrs = userAttributes(collection);
  let pending = false;
  let failed = false;
  let availableCount = 0;
  for (const attr of attrs) {
    const state = attributeState(attr);
    if (state === "failed") failed = true;
    else if (state === "pending") pending = true;
    else availableCount += 1;
  }
  return { pending, failed, availableCount, total: attrs.length };
}

function usabilityRank(collection) {
  const health = attributeHealth(collection);
  if (!health.failed && !health.pending && health.availableCount > 0) return 3;
  if (!health.failed && !health.pending) return 2;
  if (!health.failed && health.pending) return 1;
  return 0;
}

/**
 * @param {Array<{ name?: string, $updatedAt?: string, attributes?: Array<{ key?: string, status?: string }> }>} collections
 * @param {string} name
 */
export function pickNamedCollection(collections, name) {
  const target = String(name || "");
  const list = collections || [];
  const exact = list.filter((col) => col?.name === target);
  const matches = exact.length
    ? exact
    : list.filter((col) => String(col?.name || "").toLowerCase() === target.toLowerCase());
  if (matches.length === 0) return null;

  return matches.reduce((best, col) => {
    const score = usabilityRank(col);
    const bestScore = usabilityRank(best);
    if (score !== bestScore) return score > bestScore ? col : best;
    return String(col?.$updatedAt || "") > String(best?.$updatedAt || "") ? col : best;
  });
}

/**
 * `error` means the table is missing. A collection that exists but cannot be
 * read must not flip that flag, or the settings row offers 建立 again.
 */
export function buildCollectionStatsRow({
  name,
  collection,
  fallbackColumnCount = 0,
  documentCount = 0,
  documentsError = false,
  schemaMismatch = false,
}) {
  if (!collection) {
    return {
      name,
      columnCount: fallbackColumnCount,
      documentCount: 0,
      error: true,
      schemaMismatch: false,
      attributesPending: false,
      attributesFailed: false,
      documentsError: false,
    };
  }

  const health = attributeHealth(collection);
  const blocked = health.pending || health.failed;
  return {
    name,
    collectionId: collection.$id,
    columnCount: (collection.attributes || []).length,
    documentCount: blocked ? 0 : documentCount,
    error: false,
    schemaMismatch: blocked ? false : Boolean(schemaMismatch),
    attributesPending: health.pending && !health.failed,
    attributesFailed: health.failed,
    documentsError: blocked ? false : Boolean(documentsError),
  };
}

/** Red 建立 button: the table really is not there. */
export function showsCreateButton(row) {
  return Boolean(row?.error) && !row?.collectionId;
}

/** Existing table whose columns are unfinished or whose documents cannot be read. */
export function showsRebuildButton(row) {
  if (!row?.collectionId || row.error) return false;
  return Boolean(row.attributesPending || row.attributesFailed || row.documentsError);
}
