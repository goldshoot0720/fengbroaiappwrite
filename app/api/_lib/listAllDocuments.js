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
    documents.push(...response.documents);

    if (!response.documents.length || response.documents.length < pageSize) {
      break;
    }

    cursorAfter = response.documents[response.documents.length - 1].$id;
  }

  return documents;
}
