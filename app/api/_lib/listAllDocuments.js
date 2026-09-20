const PAGE_SIZE = 100;
/** Appwrite 對 offset 有上限；超過就退回游標分頁。 */
const MAX_OFFSET = 5000;
/** 同時在飛的分頁請求數，避免一次打爆 Appwrite。 */
const PAGE_CONCURRENCY = 4;

/** 依 $id 去重：平行分頁期間若有新增文件，offset 可能讓某頁重疊。 */
function dedupeById(documents) {
  const seen = new Set();
  const result = [];
  for (const doc of documents) {
    const id = doc?.$id;
    if (id != null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    result.push(doc);
  }
  return result;
}

/** 原本的游標分頁：無法得知總數、或資料量超過 offset 上限時使用。 */
async function listByCursor(databases, databaseId, collectionId, sdk, extraQueries, firstPage) {
  const documents = [...firstPage];
  let cursorAfter = firstPage[firstPage.length - 1].$id;

  while (true) {
    const response = await databases.listDocuments(databaseId, collectionId, [
      sdk.Query.limit(PAGE_SIZE),
      ...extraQueries,
      sdk.Query.cursorAfter(cursorAfter),
    ]);

    const page = response.documents || [];
    if (!page.length) break;

    documents.push(...page);
    if (page.length < PAGE_SIZE) break;
    if (typeof response.total === "number" && documents.length >= response.total) break;

    cursorAfter = page[page.length - 1].$id;
  }

  return documents;
}

/**
 * 讀出一張表的全部文件。
 *
 * 第一頁回來時 Appwrite 會附上 total，因此剩下的頁數是已知的：改用 offset
 * 平行抓取，把原本 N 次來回的等待壓成約 N / PAGE_CONCURRENCY 次。
 * 小於一頁的表（多數情況）維持單一請求，行為不變。
 */
export async function listAllDocuments(databases, databaseId, collectionId, sdk, extraQueries = []) {
  const first = await databases.listDocuments(databaseId, collectionId, [
    sdk.Query.limit(PAGE_SIZE),
    ...extraQueries,
  ]);

  const firstPage = first.documents || [];
  if (firstPage.length < PAGE_SIZE) return firstPage;

  const total = typeof first.total === "number" ? first.total : null;
  if (total !== null && total <= firstPage.length) return firstPage;

  // 總數未知或超出 offset 上限 → 走游標分頁。
  if (total === null || total > MAX_OFFSET) {
    return listByCursor(databases, databaseId, collectionId, sdk, extraQueries, firstPage);
  }

  const offsets = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset);
  }

  const pages = new Array(offsets.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(PAGE_CONCURRENCY, offsets.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= offsets.length) return;

        const response = await databases.listDocuments(databaseId, collectionId, [
          sdk.Query.limit(PAGE_SIZE),
          sdk.Query.offset(offsets[index]),
          ...extraQueries,
        ]);
        pages[index] = response.documents || [];
      }
    }
  );

  await Promise.all(workers);

  const documents = [...firstPage];
  for (const page of pages) {
    if (page) documents.push(...page);
  }

  return dedupeById(documents);
}
