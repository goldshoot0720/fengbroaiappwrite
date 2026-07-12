import { listAllDocuments } from "./listAllDocuments";

/**
 * Count other documents that share the same field value.
 * Uses indexed Query.equal first; falls back to full scan if the query fails.
 */
export async function countOtherDocumentsWithField(
  databases,
  databaseId,
  collectionId,
  sdk,
  field,
  value,
  excludeId
) {
  if (!value) return 0;

  try {
    const response = await databases.listDocuments(databaseId, collectionId, [
      sdk.Query.equal(field, value),
      sdk.Query.limit(100),
    ]);
    return response.documents.filter((doc) => doc.$id !== excludeId).length;
  } catch {
    const allDocs = await listAllDocuments(databases, databaseId, collectionId, sdk);
    return allDocs.filter((doc) => doc.$id !== excludeId && doc[field] === value).length;
  }
}

/** True when any other document still references this field value. */
export async function isFieldReferencedByOthers(
  databases,
  databaseId,
  collectionId,
  sdk,
  field,
  value,
  excludeId
) {
  return (
    (await countOtherDocumentsWithField(
      databases,
      databaseId,
      collectionId,
      sdk,
      field,
      value,
      excludeId
    )) > 0
  );
}
