import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import {
  createAppwrite,
  getCollection,
  getCollectionId,
  filterPayloadByAttributes,
} from "../_lib/appwriteClient";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

const MAX_RECORDS = 200;

function parseRecordsJson(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) return null;
        const date =
          typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? item.date
            : null;
        if (!date) return null;
        return {
          id: typeof item.id === "string" && item.id ? item.id : sdk.ID.unique(),
          price,
          date,
          note:
            typeof item.note === "string" && item.note.trim()
              ? item.note.trim().slice(0, 200)
              : undefined,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_RECORDS)
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  } catch {
    return [];
  }
}

function serializeRecords(records) {
  const cleaned = parseRecordsJson(JSON.stringify(Array.isArray(records) ? records : []));
  return JSON.stringify(
    cleaned.map((r) => ({
      id: r.id,
      price: r.price,
      date: r.date,
      ...(r.note ? { note: r.note } : {}),
    }))
  );
}

function toClientProduct(doc) {
  return {
    id: doc.$id,
    name: doc.name || "",
    shop: doc.shop || undefined,
    note: doc.note || undefined,
    currency: doc.currency || "TWD",
    localId: doc.localId || undefined,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now(),
    updatedAt: doc.$updatedAt ? new Date(doc.$updatedAt).getTime() : Date.now(),
    records: parseRecordsJson(doc.recordsJson),
  };
}

function buildPayload(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { error: "商品名稱為必填" };
  }

  const recordsSource =
    body.records !== undefined
      ? body.records
      : body.recordsJson !== undefined
        ? parseRecordsJson(
            typeof body.recordsJson === "string"
              ? body.recordsJson
              : JSON.stringify(body.recordsJson)
          )
        : [];

  const payload = {
    name: name.slice(0, 200),
    shop:
      typeof body.shop === "string" && body.shop.trim()
        ? body.shop.trim().slice(0, 100)
        : "",
    note:
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : "",
    currency:
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase().slice(0, 20)
        : "TWD",
    recordsJson: serializeRecords(recordsSource),
  };

  if (typeof body.localId === "string" && body.localId.trim()) {
    payload.localId = body.localId.trim().slice(0, 100);
  }

  return { payload };
}

// GET /api/manualprice
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "manualprice");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || "";
      if (errMsg.includes("Bandwidth") || errMsg.includes("bandwidth") || errMsg.includes("exceeded")) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      return NextResponse.json(
        { error: "Table manualprice 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc("$updatedAt"),
    ]);

    return NextResponse.json(documents.map(toClientProduct));
  } catch (err) {
    console.error("GET /api/manualprice error:", err);
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}

// POST /api/manualprice
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collection = await getCollection(databases, databaseId, "manualprice");
    const collectionId = collection.$id;

    const body = await req.json();
    const built = buildPayload(body);
    if (built.error) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const filteredPayload = filterPayloadByAttributes(built.payload, collection, [
      "name",
      "shop",
      "note",
      "currency",
      "recordsJson",
      "localId",
    ]);

    const doc = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      filteredPayload
    );

    return NextResponse.json(toClientProduct(doc));
  } catch (err) {
    console.error("POST /api/manualprice error:", err);
    const message = err.message || "Create failed";
    if (message.includes("Collection") || message.includes("not found") || message.includes("could not be found")) {
      return NextResponse.json(
        { error: "Table manualprice 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
