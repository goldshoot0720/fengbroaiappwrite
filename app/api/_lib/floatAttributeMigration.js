import { listAllDocuments } from "./listAllDocuments";

const sdk = require("node-appwrite");

/** 一次呼叫最多花在搬資料的時間，留餘裕給 serverless 逾時。 */
const COPY_BUDGET_MS = 7000;

function sameValue(a, b) {
  return (a ?? null) === (b ?? null);
}

/** 把 fromKey 的值抄到 toKey；時間用完就停，回傳是否全部抄完。 */
async function copyAttribute(databases, databaseId, collectionId, fromKey, toKey) {
  const started = Date.now();
  const documents = await listAllDocuments(databases, databaseId, collectionId, sdk);
  for (const doc of documents) {
    if (sameValue(doc[fromKey], doc[toKey])) continue;
    if (Date.now() - started > COPY_BUDGET_MS) return false;
    const value = doc[fromKey] == null ? null : Number(doc[fromKey]);
    await databases.updateDocument(databaseId, collectionId, doc.$id, { [toKey]: value });
  }
  return true;
}

/**
 * 把 integer 欄位原地改成 float，一次只推進一步（冪等，可重複呼叫）。
 *
 * Appwrite 不能直接改欄位型別，只能刪掉重建，所以值先搬到暫存 float 欄位：
 *   1. 建立暫存欄位 <key>_float_tmp
 *   2. 抄 <key> → 暫存欄位，刪除原 integer 欄位
 *   3. 以 float 重建 <key>
 *   4. 抄暫存欄位 → <key>，刪除暫存欄位
 * 每一步都依 Appwrite 目前的欄位狀態決定，因此中途失敗重跑也不會遺失資料。
 *
 * @returns {Promise<{ status: "done" | "pending", step: string }>}
 */
export async function stepIntegerToFloat(databases, databaseId, collectionId, key) {
  const tmpKey = `${key}_float_tmp`;
  const collection = await databases.getCollection(databaseId, collectionId);
  const attrs = new Map((collection.attributes || []).map((attr) => [attr.key, attr]));
  const main = attrs.get(key);
  const tmp = attrs.get(tmpKey);

  for (const attr of [main, tmp]) {
    if (!attr) continue;
    if (attr.status === "failed" || attr.status === "stuck") {
      throw new Error(`欄位 ${attr.key} 狀態為 ${attr.status}：${attr.error || "請到 Appwrite 主控台檢查"}`);
    }
    if (attr.status && attr.status !== "available") {
      return { status: "pending", step: `等待 ${attr.key}（${attr.status}）` };
    }
  }

  const mainIsFloat = main?.type === "double";

  if (mainIsFloat && !tmp) return { status: "done", step: `${key} 已是 float` };

  if (main && !mainIsFloat) {
    if (!tmp) {
      await databases.createFloatAttribute(databaseId, collectionId, tmpKey, false);
      return { status: "pending", step: `建立暫存欄位 ${tmpKey}` };
    }
    if (!(await copyAttribute(databases, databaseId, collectionId, key, tmpKey))) {
      return { status: "pending", step: `備份 ${key} 中` };
    }
    await databases.deleteAttribute(databaseId, collectionId, key);
    return { status: "pending", step: `刪除舊的 integer ${key}` };
  }

  if (!main) {
    await databases.createFloatAttribute(databaseId, collectionId, key, false);
    return { status: "pending", step: `以 float 重建 ${key}` };
  }

  // main 已是 float，暫存欄位還在 → 抄回來再清掉暫存欄位。
  if (!(await copyAttribute(databases, databaseId, collectionId, tmpKey, key))) {
    return { status: "pending", step: `還原 ${key} 中` };
  }
  await databases.deleteAttribute(databaseId, collectionId, tmpKey);
  return { status: "pending", step: `刪除暫存欄位 ${tmpKey}` };
}
