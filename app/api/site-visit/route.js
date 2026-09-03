import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";
import { displaySiteVisitStreak, nextSiteVisitStreak } from "@/lib/siteVisitStreak";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

function emptyStats(extra = {}) {
  return {
    count: 0,
    currentStreak: 0,
    lastVisitAt: null,
    lastVisitDate: null,
    exists: false,
    ...extra,
  };
}

function statsFromDoc(doc, exists = true) {
  const lastVisitAt = doc?.lastVisitAt || null;
  const lastVisitDate = doc?.lastVisitDate || null;
  return {
    count: doc?.count || 0,
    currentStreak: displaySiteVisitStreak({
      lastVisitDate,
      lastVisitAt,
      currentStreak: doc?.currentStreak,
    }),
    lastVisitAt,
    lastVisitDate,
    exists,
  };
}

async function ensureStreakFields(databases, databaseId, collectionId) {
  try {
    const collection = await databases.getCollection(databaseId, collectionId);
    const keys = new Set((collection.attributes || []).map((attr) => attr.key));
    if (!keys.has("currentStreak")) {
      try {
        await databases.createIntegerAttribute(databaseId, collectionId, "currentStreak", false);
      } catch (err) {
        if (err.code !== 409) console.error("create currentStreak:", err);
      }
    }
    if (!keys.has("lastVisitDate")) {
      try {
        await databases.createStringAttribute(databaseId, collectionId, "lastVisitDate", 10, false);
      } catch (err) {
        if (err.code !== 409) console.error("create lastVisitDate:", err);
      }
    }
  } catch (err) {
    console.error("ensureStreakFields:", err);
  }
}

async function writeVisit(databases, databaseId, collectionId, docId, data, create) {
  const full = {
    count: data.count,
    lastVisitAt: data.lastVisitAt,
    currentStreak: data.currentStreak,
    lastVisitDate: data.lastVisitDate,
  };
  const fallback = { count: data.count, lastVisitAt: data.lastVisitAt };
  try {
    if (create) {
      return await databases.createDocument(databaseId, collectionId, docId, full);
    }
    return await databases.updateDocument(databaseId, collectionId, docId, full);
  } catch {
    await ensureStreakFields(databases, databaseId, collectionId);
    try {
      if (create) {
        return await databases.createDocument(databaseId, collectionId, docId, full);
      }
      return await databases.updateDocument(databaseId, collectionId, docId, full);
    } catch {
      if (create) {
        return await databases.createDocument(databaseId, collectionId, docId, fallback);
      }
      return await databases.updateDocument(databaseId, collectionId, docId, fallback);
    }
  }
}

// 鋒兄關於：進站人次與連續進站天數。單一計數文件（第一筆文件即為計數器），沒有表格時安全回退成 0。
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "sitevisit", { required: false });
    if (!collectionId) {
      return NextResponse.json(emptyStats());
    }

    const docs = await databases.listDocuments(databaseId, collectionId, [sdk.Query.limit(1)]);
    return NextResponse.json(statsFromDoc(docs.documents[0], true));
  } catch (err) {
    console.error("GET /site-visit error:", err);
    return NextResponse.json(emptyStats({ error: err.message }));
  }
}

// 新增一次到站紀錄（由前端每個瀏覽器 session 呼叫一次）
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "sitevisit", { required: false });
    if (!collectionId) {
      return NextResponse.json(
        { success: false, error: "Table sitevisit 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    const now = new Date();
    const lastVisitAt = now.toISOString();
    const docs = await databases.listDocuments(databaseId, collectionId, [sdk.Query.limit(1)]);
    const existing = docs.documents[0];
    const streak = nextSiteVisitStreak({
      lastVisitDate: existing?.lastVisitDate,
      lastVisitAt: existing?.lastVisitAt,
      currentStreak: existing?.currentStreak,
      now,
    });
    const payload = {
      count: (existing?.count || 0) + 1,
      lastVisitAt,
      currentStreak: streak.currentStreak,
      lastVisitDate: streak.today,
    };

    const saved = existing
      ? await writeVisit(databases, databaseId, collectionId, existing.$id, payload, false)
      : await writeVisit(databases, databaseId, collectionId, sdk.ID.unique(), payload, true);

    return NextResponse.json({
      success: true,
      count: saved.count,
      currentStreak: payload.currentStreak,
      lastVisitAt: saved.lastVisitAt,
      lastVisitDate: payload.lastVisitDate,
    });
  } catch (err) {
    console.error("POST /site-visit error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
