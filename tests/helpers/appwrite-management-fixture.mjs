// Loopback-only, in-memory Appwrite fixture. Never contains or calls real accounts.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { MANAGEMENT_TABLE_SCHEMAS } from "../../lib/managementRecords.ts";

export async function startManagementFixture({ port = 0, seed = true, accountCount = 33 } = {}) {
  const collections = new Map();
  const documents = new Map();
  const writes = [];
  let failureStatus = 0;
  let queriedCollectionFailure = 0;
  let attributeFailure = false;

  function addCollection(name, id = name, attributes = MANAGEMENT_TABLE_SCHEMAS[name]?.attributes || []) {
    const collection = { $id: id, name, $databaseId: "fixture", $permissions: [], documentSecurity: false,
      enabled: true, $createdAt: "2026-09-03T00:00:00.000Z", $updatedAt: "2026-09-03T00:00:00.000Z",
      attributes: attributes.map((attr) => ({ ...attr, status: "available", type: attr.type === "url" ? "string" : attr.type })), indexes: [] };
    collections.set(id, collection);
    documents.set(id, []);
    return collection;
  }
  function addDocument(collectionId, data, id) {
    const row = { ...data, $id: id, $collectionId: collectionId, $databaseId: "fixture", $permissions: [],
      $createdAt: "2026-09-03T00:00:00.000Z", $updatedAt: "2026-09-03T00:00:00.000Z" };
    documents.get(collectionId).push(row);
    return row;
  }
  if (seed) {
    addCollection("trialpurchase");
    addCollection("reinstall");
    addCollection("quota");
    addCollection("shoppinglist");
    addCollection("tubechannel");
    addCollection("tubechannel2");
    addCollection("financeinstrument");
    addCollection("financeinstrument2");
    addDocument("tubechannel", { sourceUrl: "https://www.youtube.com/@henren778/videos", alias: "一个狠人" }, "tube-henren");
    addDocument("financeinstrument", { name: "川湖", symbol: "2059.TW", provider: "yahoo", group: "taiwan",
      imageUrl1: "", imageUrl2: "", imageUrl3: "", youtubeUrl: null, bilibiliUrl: null,
      linkUrl1: "", linkUrl2: "", linkUrl3: "", featured: true }, "fin-2059");
    addDocument("shoppinglist", {
      name: "示範購物：米 10kg", plannedDate: "2026-09-30T00:00:00.000Z", price: 499, currency: "TWD",
      quantity: 1, shop: "家樂福（示範）", pickupMethod: "取貨付款", account: "buyer@example.test", note: "隔離測試資料。",
    }, "shopping-rice");
    for (let index = 1; index <= accountCount; index += 1) {
      const number = String(index).padStart(2, "0");
      addDocument("trialpurchase", {
        name: "測試服務（示範資料）", account: `account${number}@example.test`,
        eventDate: "2026-09-30T00:00:00.000Z", firstPurchasePrice: 99, regularPrice: 299,
        trialStatus: index % 2 ? "untried" : "tried",
        purchaseStatus: ["not_purchased", "purchased", "unavailable"][index % 3],
        note: index === 1 ? "隔離測試：33 個帳號，非真實服務或優惠。" : "示範帳號",
      }, `trial-${number}`);
    }
    addDocument("quota", {
      name: "AI 對話（示範）", serviceType: "ai", account: "ai-user@example.test",
      quotaRemaining: 120, quotaRatio: 60, quotaExpiry: "2026-09-30T00:00:00.000Z",
      ratio5h: 100, expiry5h: "09:00", ratioWeek: 80, expiryWeek: "2026-09-30", ratioMonth: 50, expiryMonth: "2026-09-30",
      note: "隔離測試：僅供互動測試。",
    }, "quota-ai");
    addDocument("quota", {
      name: "一般服務（示範）", serviceType: "general", account: "general@example.test",
      quotaRemaining: 5, quotaRatio: 25, note: "示範一般額度。",
    }, "quota-general");
    addDocument("reinstall", { name: "Windows 編輯器（示範）", system: "win", softwareType: "paid",
      licenseType: "paid_serial", serial: "DEMO-AAAA-BBBB-CCCC-NOT-A-REAL-LICENSE", site: "https://example.test/editor", note: "假序號，僅供互動測試。" }, "software-win");
    addDocument("reinstall", { name: "Mac 免費工具（示範）", system: "mac", softwareType: "free",
      licenseType: "none", serial: "", site: "https://example.test/mac", note: "重灌後優先安裝。" }, "software-mac");
    addDocument("reinstall", { name: "Mac 試用軟體（示範）", system: "mac", softwareType: "trial",
      licenseType: "none", serial: "", site: null, note: "保留試用類型的測試紀錄。" }, "software-trial");
  }

  function queryRows(rows, url) {
    const queries = [...url.searchParams].filter(([key]) => key.startsWith("queries")).map(([, value]) => JSON.parse(value));
    let selected = [...rows];
    for (const query of queries) {
      if (query.method === "equal") selected = selected.filter((row) => query.values.includes(row[query.attribute]));
    }
    const total = selected.length;
    const cursor = queries.find((query) => query.method === "cursorAfter")?.values?.[0];
    if (cursor) selected = selected.slice(selected.findIndex((row) => row.$id === cursor) + 1);
    const limit = queries.find((query) => query.method === "limit")?.values?.[0] ?? 25;
    return { rows: selected.slice(0, limit), total };
  }

  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");
    const send = (status, body) => {
      if (status === 204) response.removeHeader("Content-Type");
      response.writeHead(status);
      response.end(status === 204 ? undefined : JSON.stringify(body));
    };
    if (request.method === "OPTIONS") return send(204);
    if (failureStatus) return send(failureStatus, { message: "Fixture access denied", code: failureStatus, type: "general_unauthorized_scope" });
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const text = [];
      for await (const chunk of request) text.push(chunk);
      const body = text.length ? JSON.parse(Buffer.concat(text).toString()) : {};
      if (request.method !== "GET") writes.push({ method: request.method, path: url.pathname, body });
      if (segments[1] === "health") return send(200, { status: "pass" });
      if (segments[1] === "storage") return send(200, { total: 0, buckets: [] });
      if (segments[1] !== "databases") return send(404, { message: "Unknown fixture endpoint", code: 404 });
      if (segments.length === 2) return send(200, { total: 1, databases: [{ $id: "fixture", name: "隔離測試資料庫" }] });
      if (segments[2] !== "fixture") return send(404, { message: "Database not found", code: 404, type: "database_not_found" });
      if (segments.length === 3) return send(200, { $id: "fixture", name: "隔離測試資料庫", enabled: true });
      if (segments[3] !== "collections") return send(404, { message: "Unknown fixture endpoint", code: 404 });
      const collectionId = segments[4];
      if (!collectionId) {
        if (request.method === "GET") {
          if (queriedCollectionFailure && [...url.searchParams].some(([key]) => key.startsWith("queries"))) {
            return send(queriedCollectionFailure, {
              message: "Database with the requested ID could not be found.",
              code: queriedCollectionFailure,
              type: "database_not_found",
            });
          }
          const { rows, total } = queryRows([...collections.values()], url);
          return send(200, { total, collections: rows });
        }
        if (request.method === "POST") {
          if (collections.has(body.collectionId)) return send(409, { message: "Collection exists", code: 409 });
          const collection = addCollection(body.name, body.collectionId, []);
          collection.$permissions = body.permissions || [];
          return send(201, collection);
        }
      }
      const collection = collections.get(collectionId);
      if (!collection) return send(404, { message: "Collection not found", code: 404, type: "collection_not_found" });
      if (segments.length === 5) {
        if (request.method === "GET") return send(200, collection);
        if (request.method === "DELETE") {
          collections.delete(collectionId);
          documents.delete(collectionId);
          return send(204);
        }
      }
      if (segments[5] === "attributes" && request.method === "POST") {
        if (attributeFailure) return send(400, { message: "Fixture attribute creation failed", code: 400 });
        const attribute = { ...body, type: segments[6] === "url" ? "string" : segments[6], status: "available" };
        if (collection.attributes.some((attr) => attr.key === body.key)) return send(409, { message: "Attribute exists", code: 409 });
        collection.attributes.push(attribute);
        return send(202, attribute);
      }
      if (segments[5] === "documents") {
        const documentId = segments[6];
        if (!documentId && request.method === "GET") {
          const { rows, total } = queryRows(documents.get(collectionId), url);
          return send(200, { total, documents: rows });
        }
        if (!documentId && request.method === "POST") return send(201, addDocument(collectionId, body.data, body.documentId));
        const recordIndex = documents.get(collectionId).findIndex((row) => row.$id === documentId);
        if (recordIndex < 0) return send(404, { message: "Document not found", code: 404 });
        if (request.method === "PATCH") {
          Object.assign(documents.get(collectionId)[recordIndex], body.data);
          return send(200, documents.get(collectionId)[recordIndex]);
        }
        if (request.method === "DELETE") {
          documents.get(collectionId).splice(recordIndex, 1);
          return send(204);
        }
      }
      return send(404, { message: "Unknown fixture endpoint", code: 404 });
    } catch (error) {
      return send(500, { message: error.message, code: 500 });
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    endpoint: `http://127.0.0.1:${server.address().port}/v1`, collections, documents, writes, addCollection, addDocument,
    failWith: (status) => { failureStatus = status; },
    failQueriedCollectionsWith: (status) => { queriedCollectionFailure = status; },
    failAttributes: (value) => { attributeFailure = value; },
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startManagementFixture({ port: Number(process.env.MANAGEMENT_FIXTURE_PORT || 3917) });
  console.log(`Isolated Appwrite fixture: ${fixture.endpoint} (project/database/key: fixture)`);
  const stop = async () => { await fixture.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
