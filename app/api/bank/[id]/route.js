import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


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
      account
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

    const response = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      payload
    );

    return NextResponse.json(response);
  } catch (err) {
    console.error("PUT /api/bank/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
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
