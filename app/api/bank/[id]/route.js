import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


// Appwrite 拒絕資料表沒有的欄位時，錯誤訊息只寫 Unknown attribute，
// 使用者看不出下一步。補一句去哪裡補欄位。
function withMissingAttributeHint(message) {
  const match = /Unknown attribute: "([^"]+)"/.exec(message || "");
  if (!match) return message;
  return `bank 資料表還沒有「${match[1]}」欄位，請到「鋒兄設定」的 bank 按「補欄位」後再試。（${message}）`;
}

// 表單送來的是 YYYY-MM-DD，Appwrite datetime 也吃得下；
// 若帶了時間就正規化成 ISO。無法解析的字串回傳 null，讓呼叫端擋下來。
function toAppwriteDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return String(value).includes("T") ? parsed.toISOString() : String(value);
}

// PUT /api/bank/[id]
export async function PUT(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const { 
      name, 
      deposit, 
      site, 
      address,
      withdrawals,
      transfer,
      activity,
      card,
      account,
      note,
      category,
      expiry
    } = body;

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'bank');

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (deposit !== undefined) payload.deposit = parseInt(deposit, 10);
    // site 欄位：空字串表示清除，否則保留值
    if (site !== undefined) payload.site = site || null;
    if (address !== undefined) payload.address = address;
    if (withdrawals !== undefined) payload.withdrawals = parseInt(withdrawals, 10);
    if (transfer !== undefined) payload.transfer = parseInt(transfer, 10);
    // activity 欄位：Appwrite 要求 URL 格式，空字串設為 null
    if (activity !== undefined) payload.activity = activity || null;
    if (card !== undefined) payload.card = card;
    if (account !== undefined) payload.account = account;
    // 同上：只有真的填了才送這幾個欄位。
    if (note) payload.note = note;
    if (category) payload.category = category;

    const formattedExpiry = toAppwriteDate(expiry);
    if (formattedExpiry === null) {
      return NextResponse.json({ error: `Invalid date format: ${expiry}` }, { status: 400 });
    }
    if (formattedExpiry) payload.expiry = formattedExpiry;

    const response = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      payload
    );

    return NextResponse.json(response);
  } catch (err) {
    console.error("PUT /api/bank/[id] error:", err);
    return NextResponse.json({ error: withMissingAttributeHint(err.message) }, { status: 500 });
  }
}

// DELETE /api/bank/[id]
export async function DELETE(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'bank');

    await databases.deleteDocument(databaseId, collectionId, id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/bank/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
