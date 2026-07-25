import { TABLE_SCHEMAS } from "../create-table/route";
import { listAllDocuments } from "./listAllDocuments";
import {
  clearCollectionCache,
  createAppwrite as createAppwriteShared,
  getCollection as getCollectionShared,
  sdk,
} from "./appwriteClient";

const COLLECTION_NAME = "landtophistory";

function createAppwrite(searchParams) {
  try {
    return createAppwriteShared(searchParams);
  } catch {
    return null;
  }
}

async function getCollection(databases, databaseId, name = COLLECTION_NAME) {
  return getCollectionShared(databases, databaseId, name, { required: false });
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
  clearCollectionCache(databaseId);

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

function hasCapacityVariantInfo(name) {
  return /(\d{3,4}GB|\d{3,4}G|\d{1,2}G\s+\d{3,4}GB|\d{1,2}G\/\d{3,4}G)/i.test(name || "");
}

/** "Samsung A17 6G 128GB" / "Samsung A17" → "samsung a17" */
function modelBaseKey(name) {
  return String(name || "")
    .replace(/\b(\d{1,2})\s*G\s*\/\s*(\d{3,4})\s*G(B)?\b/gi, " ")
    .replace(/\b(\d{1,2})\s*G\s+(\d{3,4})\s*GB\b/gi, " ")
    .replace(/\b\d{3,4}\s*GB?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Drop bare shells (e.g. "Samsung A17") when capacity variants exist
 * ("Samsung A17 6G 128GB", "Samsung A17 8G 128GB") — used for history series too.
 */
function dropShellProductsWhenVariantsExist(products) {
  const list = Array.isArray(products) ? products : [];
  const variantBases = new Set(
    list.filter((p) => hasCapacityVariantInfo(p.name)).map((p) => modelBaseKey(p.name))
  );
  if (variantBases.size === 0) return list;
  return list.filter((product) => {
    if (hasCapacityVariantInfo(product.name)) return true;
    const base = modelBaseKey(product.name);
    return !base || !variantBases.has(base);
  });
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
  // Never snapshot brand-list shells when capacity SKUs exist (e.g. bare Samsung A17)
  const snapshotProducts = dropShellProductsWhenVariantsExist(products || []);

  if (!appwrite || !snapshotProducts.length) {
    return { available: Boolean(appwrite), stored: 0, created: 0, updated: 0 };
  }

  try {
    const { databases, databaseId } = appwrite;
    const collectionId = await ensureCollection(databases, databaseId);
    let created = 0;
    let updated = 0;

    for (const product of snapshotProducts) {
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
  // History series only for capacity SKUs when shells would duplicate (e.g. bare Samsung A17)
  const historyProducts = dropShellProductsWhenVariantsExist(products || []);
  if (!appwrite || !historyProducts.length) {
    return { available: Boolean(appwrite), histories: [] };
  }

  try {
    const { databases, databaseId } = appwrite;
    const collection = await getCollection(databases, databaseId);
    if (!collection) {
      return { available: true, histories: [] };
    }

    const productMap = new Map(historyProducts.map((product) => [product.id, product]));
    const productIds = Array.from(productMap.keys());
    const documents = await listAllDocuments(databases, databaseId, collection.$id, sdk, [
      sdk.Query.equal("productId", productIds),
      sdk.Query.orderAsc("snapshotDate"),
    ]);

    const grouped = new Map();
    for (const document of documents) {
      const product = productMap.get(document.productId);
      if (!product) continue;

      // Prefer current product name; fall back to stored name — still drop shells later
      const seriesName = product.name || document.name || "";
      if (!grouped.has(document.productId)) {
        grouped.set(document.productId, {
          id: document.productId,
          brand: product.brand || document.brand,
          name: seriesName,
          sourceUrl: product.sourceUrl || document.sourceUrl,
          points: [],
        });
      }

      grouped.get(document.productId).points.push({
        date: document.snapshotDate,
        landtopPrice: typeof document.landtopPrice === "number" ? document.landtopPrice : null,
        suggestedPrice: typeof document.suggestedPrice === "number" ? document.suggestedPrice : null,
      });
    }

    // Final safety: never chart bare "Samsung A17" if 6G/8G series are present
    const histories = dropShellProductsWhenVariantsExist(Array.from(grouped.values()));

    return {
      available: true,
      histories,
    };
  } catch (error) {
    return {
      available: true,
      histories: [],
      error: error instanceof Error ? error.message : "Failed to load Landtop history",
    };
  }
}
