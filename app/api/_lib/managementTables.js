import { NextResponse } from "next/server";
import { Client, Databases, ID, Query } from "node-appwrite";
import { createAppwrite, clearCollectionCache } from "./appwriteClient";
import { listAllDocuments } from "./listAllDocuments";
import { MANAGEMENT_TABLE_SCHEMAS } from "../../../lib/managementRecords";

function tableError(message, status) {
  return Object.assign(new Error(message), { status });
}

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function failure(error) {
  const code = Number(error.status || error.code);
  return json({ error: error.message || "操作失敗，請確認 Appwrite 連線後再試。" },
    code >= 400 && code < 600 ? code : 500);
}

// Exact lookup, scoped to the supplied client; never pick a similarly named backup
// or reuse another Appwrite project's database-id-only collection cache.
export async function findManagementTable(databases, databaseId, name) {
  const result = await databases.listCollections({
    databaseId,
    queries: [Query.equal("name", [name]), Query.limit(2)],
  });
  const matches = result.collections.filter((collection) => collection.name === name);
  if (matches.length > 1) throw tableError(`有多個同名 Table ${name}，請在 Appwrite 確認正確的資料表。`, 409);
  return matches[0];
}

async function context(request, tableName) {
  const { searchParams } = new URL(request.url);
  const { databases, databaseId } = createAppwrite(searchParams);
  const collection = await findManagementTable(databases, databaseId, tableName);
  if (!collection) throw tableError(`Table ${tableName} 不存在，請至「鋒兄設定」中建立缺失 Table。`, 404);
  return { databases, databaseId, collection };
}

function assertWritable(collection, tableName) {
  const missing = MANAGEMENT_TABLE_SCHEMAS[tableName].attributes.filter((expected) =>
    !collection.attributes?.some((actual) => actual.key === expected.key && (!actual.status || actual.status === "available")));
  if (missing.length) {
    throw tableError(`Table ${tableName} 欄位尚未就緒：${missing.map((attr) => attr.key).join("、")}。請至鋒兄設定補齊欄位；若剛建立，請稍後再試。`, 409);
  }
}

async function readPayload(request, buildPayload, mode) {
  try {
    return buildPayload(await request.json(), mode);
  } catch (error) {
    throw tableError(error.message || "欄位內容不正確", 400);
  }
}

export function managementRoutes(tableName, buildPayload) {
  return {
    async GET(request) {
      try {
        const { databases, databaseId, collection } = await context(request, tableName);
        const rows = await listAllDocuments(databases, databaseId, collection.$id, { Query });
        rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
        return json(rows);
      } catch (error) { return failure(error); }
    },
    async POST(request) {
      try {
        const data = await readPayload(request, buildPayload, "create");
        const { databases, databaseId, collection } = await context(request, tableName);
        assertWritable(collection, tableName);
        const row = await databases.createDocument({ databaseId, collectionId: collection.$id, documentId: ID.unique(), data });
        return json(row, 201);
      } catch (error) { return failure(error); }
    },
    async PUT(request, routeContext) {
      try {
        const { id } = await routeContext.params;
        const data = await readPayload(request, buildPayload, "update");
        const { databases, databaseId, collection } = await context(request, tableName);
        assertWritable(collection, tableName);
        const row = await databases.updateDocument({ databaseId, collectionId: collection.$id, documentId: id, data });
        return json(row);
      } catch (error) { return failure(error); }
    },
    async DELETE(request, routeContext) {
      try {
        const { id } = await routeContext.params;
        const { databases, databaseId, collection } = await context(request, tableName);
        await databases.deleteDocument({ databaseId, collectionId: collection.$id, documentId: id });
        return json({ success: true });
      } catch (error) { return failure(error); }
    },
  };
}

// Additive setup for the new tables. Retrying a partial setup never deletes records.
export async function initializeManagementTable(config, tableName, send = () => {}) {
  const schema = MANAGEMENT_TABLE_SCHEMAS[tableName];
  const databases = new Databases(new Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey));
  const databaseId = config.databaseId;
  send({ type: "start", tableName, totalColumns: schema.attributes.length });
  let collection = await findManagementTable(databases, databaseId, tableName);
  if (!collection) {
    try {
      // Private collection: only the existing server API-key flow can access it.
      collection = await databases.createCollection({ databaseId, collectionId: tableName, name: tableName, permissions: [], documentSecurity: false });
    } catch (error) {
      if (error.code !== 409) throw error;
      collection = await findManagementTable(databases, databaseId, tableName);
      if (!collection) throw tableError(`ID ${tableName} 已被其他 Table 使用，請在 Appwrite 確認。`, 409);
    }
  }
  const collectionId = collection.$id;
  for (const [index, attr] of schema.attributes.entries()) {
    if (!collection.attributes.some((existing) => existing.key === attr.key)) {
      const params = { databaseId, collectionId, key: attr.key, required: attr.required };
      try {
        switch (attr.type) {
          case "string": await databases.createStringAttribute({ ...params, size: attr.size }); break;
          case "integer": await databases.createIntegerAttribute({ ...params, min: 0 }); break;
          case "datetime": await databases.createDatetimeAttribute(params); break;
          case "url": await databases.createUrlAttribute(params); break;
          case "boolean": await databases.createBooleanAttribute({
            ...params,
            ...(attr.default !== undefined ? { xdefault: attr.default } : {}),
          }); break;
        }
      } catch (error) {
        if (error.code !== 409) throw error;
      }
    }
    send({ type: "progress", step: "attribute", current: index + 1, total: schema.attributes.length,
      percent: Math.round((index + 1) / schema.attributes.length * 100), attribute: attr.key,
      message: `確認 ${attr.key} (${index + 1}/${schema.attributes.length})` });
  }
  // Attribute creation is asynchronous in Appwrite. Report completion only once usable.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await databases.getCollection({ databaseId, collectionId });
    const pending = schema.attributes.filter((expected) => !current.attributes.some((actual) =>
      actual.key === expected.key && actual.status === "available"));
    if (!pending.length) {
      clearCollectionCache(databaseId);
      return { success: true, collectionId, message: `${tableName} 已就緒（${schema.attributes.length} 欄位），既有資料保留。` };
    }
    if (current.attributes.some((attr) => ["failed", "stuck"].includes(attr.status))) {
      throw tableError(`Table ${tableName} 有欄位建立失敗，請至 Appwrite 查看狀態；既有資料未刪除。`, 409);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw tableError(`Table ${tableName} 欄位仍在建立，請稍後重新整理；既有資料未刪除。`, 409);
}
