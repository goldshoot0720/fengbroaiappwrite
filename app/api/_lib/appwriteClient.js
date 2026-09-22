/**
 * Shared Appwrite client helpers for API routes.
 * - Centralizes config resolution (searchParams / headers / plain object / env)
 * - Caches collection lookups per database to avoid listCollections on every request
 */

const sdk = require("node-appwrite");

/** 新鮮期：期間內直接用快取，不打 Appwrite。 */
const COLLECTION_CACHE_TTL_MS = 5 * 60_000;
/** 過期但仍可先用的上限：先回舊值，背景重新整理（stale-while-revalidate）。 */
const COLLECTION_CACHE_STALE_MS = 30 * 60_000;
/** listCollections 一頁筆數；Appwrite 預設只回 25 筆，表多時會漏找。 */
const COLLECTION_PAGE_SIZE = 100;
/** @type {Map<string, { expires: number, staleUntil: number, byName: Map<string, any>, list: any[] }>} */
const collectionCache = new Map();
/** 同一把鍵的 listCollections 在飛行中只發一次（首頁同時打十幾支 API 時很關鍵）。 */
/** @type {Map<string, Promise<any>>} */
const collectionInflight = new Map();

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
  if (!databaseId) {
    collectionCache.clear();
    collectionInflight.clear();
    return;
  }
  // 快取鍵含 endpoint / project，呼叫端只知道 databaseId → 清掉所有同 databaseId 的鍵。
  const suffix = `|${databaseId}`;
  for (const key of [...collectionCache.keys()]) {
    if (key === String(databaseId) || key.endsWith(suffix)) collectionCache.delete(key);
  }
  for (const key of [...collectionInflight.keys()]) {
    if (key === String(databaseId) || key.endsWith(suffix)) collectionInflight.delete(key);
  }
}

/** 不同帳號（project）可能有同名 databaseId，快取鍵必須區分連線。 */
function collectionCacheKey(databases, databaseId) {
  const config = databases?.client?.config || {};
  return `${config.endpoint || ""}|${config.project || ""}|${databaseId}`;
}

async function fetchAllCollections(databases, databaseId) {
  const list = [];
  let offset = 0;
  // 分頁抓完所有 collection；舊版 SDK 不支援 queries 參數時退回單次呼叫。
  while (true) {
    let response;
    try {
      response = await databases.listCollections(databaseId, [
        sdk.Query.limit(COLLECTION_PAGE_SIZE),
        sdk.Query.offset(offset),
      ]);
    } catch (err) {
      if (offset === 0 && /query|limit|offset/i.test(String(err?.message || ""))) {
        response = await databases.listCollections(databaseId);
        list.push(...(response.collections || []));
        break;
      }
      throw err;
    }
    const page = response.collections || [];
    list.push(...page);
    if (page.length < COLLECTION_PAGE_SIZE) break;
    if (typeof response.total === "number" && list.length >= response.total) break;
    offset += page.length;
  }
  return list;
}

function refreshCollections(databases, databaseId, key) {
  const pending = collectionInflight.get(key);
  if (pending) return pending;

  const request = fetchAllCollections(databases, databaseId)
    .then((list) => {
      const byName = new Map();
      for (const col of list) {
        if (col?.name) byName.set(String(col.name).toLowerCase(), col);
        if (col?.$id) byName.set(String(col.$id).toLowerCase(), col);
      }
      const now = Date.now();
      const entry = {
        expires: now + COLLECTION_CACHE_TTL_MS,
        staleUntil: now + COLLECTION_CACHE_STALE_MS,
        byName,
        list,
      };
      collectionCache.set(key, entry);
      return entry;
    })
    .finally(() => {
      collectionInflight.delete(key);
    });

  collectionInflight.set(key, request);
  return request;
}

async function loadCollections(databases, databaseId, { force = false } = {}) {
  const key = collectionCacheKey(databases, databaseId);
  const now = Date.now();
  const cached = collectionCache.get(key);

  if (!force && cached) {
    if (cached.expires > now) return cached;
    if (cached.staleUntil > now) {
      // 先用舊結果回應，背景更新；collection id 幾乎不會變。
      refreshCollections(databases, databaseId, key).catch(() => {});
      return cached;
    }
  }

  return refreshCollections(databases, databaseId, key);
}

function findCollection(entry, name) {
  const normalizedName = String(name).toLowerCase();
  const exact =
    entry.list.find((c) => c.name === name) ||
    entry.list.find((c) => c.$id === name) ||
    entry.byName.get(normalizedName);
  if (exact) return exact;

  return (
    entry.list.find((c) => String(c.name || "").toLowerCase().includes(normalizedName)) ||
    entry.list.find((c) => String(c.$id || "").toLowerCase().includes(normalizedName)) ||
    null
  );
}

/**
 * Fuzzy collection lookup (name, id, case-insensitive, includes).
 * @param {boolean} [options.required=true] throw when missing
 * @param {boolean} [options.useCache=true]
 */
export async function getCollection(databases, databaseId, name, options = {}) {
  const { required = true, useCache = true } = options;

  let entry = await loadCollections(databases, databaseId, { force: !useCache });
  let found = findCollection(entry, name);

  // 快取裡找不到：可能是別的實例剛建立的表，強制重抓一次再判定。
  if (!found && useCache) {
    entry = await loadCollections(databases, databaseId, { force: true });
    found = findCollection(entry, name);
  }

  if (found) return found;
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
