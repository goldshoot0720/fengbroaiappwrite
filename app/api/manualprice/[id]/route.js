import { NextResponse } from "next/server";
import {
  createAppwrite,
  getCollection,
  getCollectionId,
  filterPayloadByAttributes,
} from "../../_lib/appwriteClient";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

const MAX_RECORDS = 200;
const ALLOWED_CURRENCIES = new Set(["TWD", "USD", "JPY"]);

function normalizeCurrency(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return ALLOWED_CURRENCIES.has(code) ? code : "TWD";
}

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
    currency: normalizeCurrency(doc.currency),
    localId: doc.localId || undefined,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt).getTime() : Date.now(),
    updatedAt: doc.$updatedAt ? new Date(doc.$updatedAt).getTime() : Date.now(),
    records: parseRecordsJson(doc.recordsJson),
  };
}

function buildUpdatePayload(body) {
  const payload = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "商品名稱不可為空" };
    payload.name = name.slice(0, 200);
  }

  if (body.currency !== undefined) {
    payload.currency = normalizeCurrency(body.currency);
  }

  if (body.records !== undefined || body.recordsJson !== undefined) {
    const recordsSource =
      body.records !== undefined
        ? body.records
        : parseRecordsJson(
            typeof body.recordsJson === "string"
              ? body.recordsJson
              : JSON.stringify(body.recordsJson)
          );
    payload.recordsJson = serializeRecords(recordsSource);
  }

  if (body.localId !== undefined) {
    payload.localId =
      typeof body.localId === "string" && body.localId.trim()
        ? body.localId.trim().slice(0, 100)
        : "";
  }

  if (Object.keys(payload).length === 0) {
    return { error: "沒有可更新的欄位" };
  }

  return { payload };
}

// PUT /api/manualprice/[id]
export async function PUT(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collection = await getCollection(databases, databaseId, "manualprice");
    const collectionId = collection.$id;

    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const built = buildUpdatePayload(body);
    if (built.error) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const filteredPayload = filterPayloadByAttributes(built.payload, collection, [
      "name",
      "currency",
      "recordsJson",
      "localId",
    ]);

    const doc = await databases.updateDocument(databaseId, collectionId, id, filteredPayload);
    return NextResponse.json(toClientProduct(doc));
  } catch (err) {
    console.error("PUT /api/manualprice/[id] error:", err);
    const message = err.message || "Update failed";
    if (message.includes("Collection") || message.includes("not found") || message.includes("could not be found")) {
      return NextResponse.json(
        { error: "Table manualprice 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/manualprice/[id]
export async function DELETE(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "manualprice");

    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await databases.deleteDocument(databaseId, collectionId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/manualprice/[id] error:", err);
    const message = err.message || "Delete failed";
    if (message.includes("Collection") || message.includes("not found") || message.includes("could not be found")) {
      return NextResponse.json(
        { error: "Table manualprice 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
