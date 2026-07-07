import { TABLE_SCHEMAS } from "../create-table/route";
import { listAllDocuments } from "./listAllDocuments";

const sdk = require("node-appwrite");

const COLLECTION_NAME = "landtophistory";

function createAppwrite(searchParams) {
  const endpoint = searchParams?.get("_endpoint") || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = searchParams?.get("_project") || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = searchParams?.get("_database") || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = searchParams?.get("_key") || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return null;
  }

  const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new sdk.Databases(client);

  return { databases, databaseId };
}

async function getCollection(databases, databaseId, name = COLLECTION_NAME) {
  const allCollections = await databases.listCollections(databaseId);
  return allCollections.collections.find((collection) => collection.name === name) || null;
}

async function createAttribute(databases, databaseId, collectionId, attribute) {
  switch (attribute.type) {
    case "string":
      await databases.createStringAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.size,
        Boolean(attribute.required)
      );
      break;
    case "integer":
      await databases.createIntegerAttribute(databaseId, collectionId, attribute.key, Boolean(attribute.required));
      break;
    case "url":
      await databases.createUrlAttribute(databaseId, collectionId, attribute.key, Boolean(attribute.required));
      break;
    case "datetime":
      await databases.createDatetimeAttribute(databaseId, collectionId, attribute.key, Boolean(attribute.required));
      break;
    case "boolean":
      await databases.createBooleanAttribute(databaseId, collectionId, attribute.key, Boolean(attribute.required));
      break;
    default:
      throw new Error(`Unsupported Appwrite attribute type: ${attribute.type}`);
  }
}

async function ensureCollection(databases, databaseId) {
  const existing = await getCollection(databases, databaseId);
  if (existing) {
    return existing.$id;
  }

  const schema = TABLE_SCHEMAS[COLLECTION_NAME];
  if (!schema) {
    throw new Error(`Missing schema for ${COLLECTION_NAME}`);
  }

  const collection = await databases.createCollection(
    databaseId,
    sdk.ID.unique(),
    COLLECTION_NAME,
    [
      sdk.Permission.read(sdk.Role.any()),
      sdk.Permission.create(sdk.Role.any()),
      sdk.Permission.update(sdk.Role.any()),
      sdk.Permission.delete(sdk.Role.any()),
    ]
  );

  for (const attribute of schema.attributes) {
    await createAttribute(databases, databaseId, collection.$id, attribute);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  return collection.$id;
}

function toSnapshotDay(snapshotAt) {
  return snapshotAt.toISOString().slice(0, 10);
}

function buildSnapshotDocument(product, snapshotAt) {
  const snapshotDate = snapshotAt.toISOString();
  const snapshotDay = toSnapshotDay(snapshotAt);

  return {
    source: "landtop",
    snapshotKey: `${snapshotDay}::${product.id}`,
    productId: product.id,
    brand: product.brand,
    name: product.name,
    sourceUrl: product.sourceUrl,
    landtopPrice: typeof product.landtopPrice === "number" ? product.landtopPrice : undefined,
    suggestedPrice: typeof product.suggestedPrice === "number" ? product.suggestedPrice : undefined,
    snapshotDate,
  };
}

export async function persistLandtopSnapshots({ searchParams, products, snapshotAt = new Date() }) {
  const appwrite = createAppwrite(searchParams);
  if (!appwrite || !products.length) {
    return { available: Boolean(appwrite), stored: 0, created: 0, updated: 0 };
  }

  try {
    const { databases, databaseId } = appwrite;
    const collectionId = await ensureCollection(databases, databaseId);
    let created = 0;
    let updated = 0;

    for (const product of products) {
      const payload = buildSnapshotDocument(product, snapshotAt);
      const existing = await databases.listDocuments(databaseId, collectionId, [
        sdk.Query.equal("snapshotKey", [payload.snapshotKey]),
        sdk.Query.limit(1),
      ]);

      if (existing.documents.length > 0) {
        await databases.updateDocument(databaseId, collectionId, existing.documents[0].$id, payload);
        updated += 1;
      } else {
        await databases.createDocument(databaseId, collectionId, sdk.ID.unique(), payload);
        created += 1;
      }
    }

    return { available: true, stored: created + updated, created, updated };
  } catch (error) {
    return {
      available: true,
      stored: 0,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : "Failed to persist Landtop history",
    };
  }
}

export async function loadLandtopHistories({ searchParams, products }) {
  const appwrite = createAppwrite(searchParams);
  if (!appwrite || !products.length) {
    return { available: Boolean(appwrite), histories: [] };
  }

  try {
    const { databases, databaseId } = appwrite;
    const collection = await getCollection(databases, databaseId);
    if (!collection) {
      return { available: true, histories: [] };
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const productIds = Array.from(productMap.keys());
    const documents = await listAllDocuments(databases, databaseId, collection.$id, sdk, [
      sdk.Query.equal("productId", productIds),
      sdk.Query.orderAsc("snapshotDate"),
    ]);

    const grouped = new Map();
    for (const document of documents) {
      const product = productMap.get(document.productId);
      if (!product) continue;

      if (!grouped.has(document.productId)) {
        grouped.set(document.productId, {
          id: document.productId,
          brand: product.brand,
          name: product.name,
          sourceUrl: product.sourceUrl,
          points: [],
        });
      }

      grouped.get(document.productId).points.push({
        date: document.snapshotDate,
        landtopPrice: typeof document.landtopPrice === "number" ? document.landtopPrice : null,
        suggestedPrice: typeof document.suggestedPrice === "number" ? document.suggestedPrice : null,
      });
    }

    return {
      available: true,
      histories: Array.from(grouped.values()),
    };
  } catch (error) {
    return {
      available: true,
      histories: [],
      error: error instanceof Error ? error.message : "Failed to load Landtop history",
    };
  }
}
