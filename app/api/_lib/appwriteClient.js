/**
 * Shared Appwrite client helpers for API routes.
 * - Centralizes config resolution (searchParams / headers / plain object / env)
 * - Caches collection lookups per database to avoid listCollections on every request
 */

const sdk = require("node-appwrite");

const COLLECTION_CACHE_TTL_MS = 60_000;
/** @type {Map<string, { expires: number, byName: Map<string, any>, list: any[] }>} */
const collectionCache = new Map();

function pickFirst(...values) {
  for (const value of values) {
    if (value != null && value !== "" && value !== "undefined" && value !== "null") {
      return value;
    }
  }
  return "";
}

/**
 * Normalize config from URLSearchParams, plain object, or dual sources.
 * @param {URLSearchParams | Record<string, any> | null | undefined} primary
 * @param {Record<string, any>} [secondary]
 */
export function resolveAppwriteConfig(primary = null, secondary = {}) {
  const isSearchParams =
    primary &&
    typeof primary.get === "function" &&
    typeof primary.has === "function";

  const fromParams = (key) => (isSearchParams ? primary.get(key) : null);
  const fromObject = (obj, ...keys) => {
    if (!obj || typeof obj !== "object") return null;
    for (const key of keys) {
      if (obj[key] != null && obj[key] !== "") return obj[key];
    }
    return null;
  };

  const plain = isSearchParams ? secondary : { ...(primary || {}), ...secondary };

  return {
    endpoint: pickFirst(
      fromObject(plain, "endpoint", "_endpoint"),
      fromParams("_endpoint"),
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    ),
    projectId: pickFirst(
      fromObject(plain, "projectId", "project", "_project"),
      fromParams("_project"),
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    ),
    databaseId: pickFirst(
      fromObject(plain, "databaseId", "database", "_database"),
      fromParams("_database"),
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      process.env.APPWRITE_DATABASE_ID
    ),
    apiKey: pickFirst(
      fromObject(plain, "apiKey", "appwriteApiKey", "key", "_key"),
      fromParams("_key"),
      process.env.NEXT_PUBLIC_APPWRITE_API_KEY,
      process.env.APPWRITE_API_KEY
    ),
    bucketId: pickFirst(
      fromObject(plain, "bucketId", "bucket", "_bucket"),
      fromParams("_bucket"),
      process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID,
      process.env.APPWRITE_BUCKET_ID
    ),
  };
}

function isOptionsBag(value) {
  if (!value || typeof value !== "object" || typeof value.get === "function") return false;
  return (
    "requireDatabase" in value ||
    "requireBucket" in value ||
    "requireApiKey" in value ||
    "secondary" in value
  );
}

/**
 * Create Appwrite SDK services.
 * @param {URLSearchParams | Record<string, any> | null} [source]
 * @param {{ requireDatabase?: boolean, requireBucket?: boolean, requireApiKey?: boolean, secondary?: Record<string, any> } | Record<string, any>} [optionsOrSecondary]
 *        Also accepts a legacy secondary config object (e.g. request body) as the second argument.
 */
export function createAppwrite(source = null, optionsOrSecondary = {}) {
  const options = isOptionsBag(optionsOrSecondary)
    ? optionsOrSecondary
    : { secondary: optionsOrSecondary || {} };

  const secondary = options.secondary || {};
  const config = resolveAppwriteConfig(source, secondary);
  const { endpoint, projectId, databaseId, apiKey, bucketId } = config;

  const isSearchParams =
    source && typeof source.get === "function" && typeof source.has === "function";
  const plainSource =
    !isSearchParams && source && typeof source === "object" ? source : null;

  // Plain object with bucket but no database → storage upload helper mode.
  const storageOnly =
    options.requireBucket === true ||
    Boolean(
      plainSource &&
        (plainSource.bucketId || plainSource.bucket || plainSource._bucket) &&
        !(plainSource.databaseId || plainSource.database || plainSource._database)
    );

  const requireDatabase =
    options.requireDatabase !== undefined ? options.requireDatabase : !storageOnly;
  const requireBucket =
    options.requireBucket !== undefined ? options.requireBucket : storageOnly;
  const requireApiKey = options.requireApiKey !== undefined ? options.requireApiKey : true;

  if (!endpoint || !projectId) {
    throw new Error("Appwrite configuration is missing");
  }
  if (requireApiKey && !apiKey) {
    throw new Error("Appwrite configuration is missing");
  }
  if (requireDatabase && !databaseId) {
    throw new Error("Appwrite configuration is missing");
  }
  if (requireBucket && !bucketId) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) client.setKey(apiKey);

  return {
    client,
    databases: new sdk.Databases(client),
    storage: new sdk.Storage(client),
    databaseId,
    bucketId,
    endpoint,
    projectId,
    apiKey,
    sdk,
  };
}

/** Create client from request headers (upload routes). */
export function createAppwriteFromHeaders(headers) {
  return createAppwrite(
    {
      endpoint: headers.get?.("x-appwrite-endpoint") ?? headers["x-appwrite-endpoint"],
      projectId: headers.get?.("x-appwrite-project") ?? headers["x-appwrite-project"],
      apiKey: headers.get?.("x-appwrite-key") ?? headers["x-appwrite-key"],
      bucketId: headers.get?.("x-appwrite-bucket") ?? headers["x-appwrite-bucket"],
      databaseId: headers.get?.("x-appwrite-database") ?? headers["x-appwrite-database"],
    },
    { requireDatabase: false, requireBucket: true }
  );
}

export function clearCollectionCache(databaseId) {
  if (databaseId) {
    collectionCache.delete(String(databaseId));
  } else {
    collectionCache.clear();
  }
}

async function loadCollections(databases, databaseId) {
  const key = String(databaseId);
  const now = Date.now();
  const cached = collectionCache.get(key);
  if (cached && cached.expires > now) {
    return cached;
  }

  const response = await databases.listCollections(databaseId);
  const list = response.collections || [];
  const byName = new Map();

  for (const col of list) {
    if (col?.name) byName.set(String(col.name).toLowerCase(), col);
    if (col?.$id) byName.set(String(col.$id).toLowerCase(), col);
  }

  const entry = { expires: now + COLLECTION_CACHE_TTL_MS, byName, list };
  collectionCache.set(key, entry);
  return entry;
}

/**
 * Fuzzy collection lookup (name, id, case-insensitive, includes).
 * @param {boolean} [options.required=true] throw when missing
 * @param {boolean} [options.useCache=true]
 */
export async function getCollection(databases, databaseId, name, options = {}) {
  const { required = true, useCache = true } = options;
  const normalizedName = String(name).toLowerCase();

  let entry;
  if (useCache) {
    entry = await loadCollections(databases, databaseId);
  } else {
    clearCollectionCache(databaseId);
    entry = await loadCollections(databases, databaseId);
  }

  const exact =
    entry.list.find((c) => c.name === name) ||
    entry.list.find((c) => c.$id === name) ||
    entry.byName.get(normalizedName);

  if (exact) return exact;

  const fuzzy =
    entry.list.find((c) => String(c.name || "").toLowerCase().includes(normalizedName)) ||
    entry.list.find((c) => String(c.$id || "").toLowerCase().includes(normalizedName));

  if (fuzzy) return fuzzy;
  if (!required) return null;
  throw new Error(`Collection ${name} not found`);
}

export async function getCollectionId(databases, databaseId, name, options = {}) {
  const collection = await getCollection(databases, databaseId, name, options);
  return collection?.$id ?? null;
}

/** Keep only attributes that exist on the collection schema. */
export function filterPayloadByAttributes(payload, collection, alwaysKeep = ["name", "price"]) {
  const availableKeys = new Set(
    (collection.attributes || [])
      .filter(
        (attr) =>
          (attr.status === "available" || !attr.status) &&
          !String(attr.key || "").startsWith("$")
      )
      .map((attr) => attr.key)
  );

  const keep = new Set(alwaysKeep);
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => keep.has(key) || availableKeys.has(key))
  );
}

export { sdk };
