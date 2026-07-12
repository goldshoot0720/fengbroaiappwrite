export async function listAllDocuments(databases, databaseId, collectionId, sdk, extraQueries = []) {
  const pageSize = 100;
  const documents = [];
  let cursorAfter = null;

  while (true) {
    const queries = [sdk.Query.limit(pageSize), ...extraQueries];

    if (cursorAfter) {
      queries.push(sdk.Query.cursorAfter(cursorAfter));
    }

    const response = await databases.listDocuments(databaseId, collectionId, queries);
    const page = response.documents || [];
    if (page.length) {
      documents.push(...page);
    }

    // Prefer total when Appwrite returns it, otherwise fall back to page size.
    if (!page.length || page.length < pageSize) {
      break;
    }
    if (typeof response.total === "number" && documents.length >= response.total) {
      break;
    }

    cursorAfter = page[page.length - 1].$id;
  }

  return documents;
}
