/**
 * Appwrite list calls often return 25 rows even when the caller asks for 100.
 * Treating that short page as the end hides every later table. The console
 * still shows them; settings then reports the name as missing.
 */
export const COLLECTION_PAGE_SIZE = 100;

export function shouldContinuePaging({ pageLength, requested, fetched, total, added }) {
  if (!pageLength || !added) return false;
  if (typeof total === "number" && total > 0 && fetched >= total) return false;
  if (typeof total === "number" && total > fetched) return true;
  return pageLength >= requested;
}

export async function collectPages(fetchPage, options = {}) {
  const requested = options.pageSize || COLLECTION_PAGE_SIZE;
  const list = [];
  const seen = new Set();
  let offset = 0;

  for (let guard = 0; guard < 50; guard += 1) {
    const response = await fetchPage({ limit: requested, offset });
    const page = response?.collections || [];
    let added = 0;
    for (const col of page) {
      const id = col?.$id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      list.push(col);
      added += 1;
    }
    const total = typeof response?.total === "number" ? response.total : undefined;
    if (!shouldContinuePaging({
      pageLength: page.length,
      requested,
      fetched: list.length,
      total,
      added,
    })) {
      break;
    }
    offset += page.length || requested;
  }

  return list;
}
