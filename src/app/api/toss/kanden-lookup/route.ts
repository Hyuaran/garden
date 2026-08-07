import { NextResponse } from "next/server";

import { field, type KandenLookup } from "@/app/toss/_lib/form";
import { getRecords } from "@/app/toss/_lib/kintone.server";
import { requireActiveTossPartner, tossError } from "@/app/toss/_lib/server-auth";

export const runtime = "nodejs";

const escapeQuery = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export async function GET(request: Request) {
  try {
    await requireActiveTossPartner();
    const pd = new URL(request.url).searchParams.get("pd")?.trim();
    if (!pd) return NextResponse.json({ ok: false, error: "PD管理番号を入力してください" }, { status: 400 });
    const appId = process.env.KINTONE_KANDEN_LIST_APP_ID || "";
    const token = process.env.KINTONE_KANDEN_LIST_TOKEN || "";
    // 照合キーは app55「管理番号3（文字列__1行__0）」＝PD無しの数字。
    // 「管理番号1（文字列__1行__1）」は "PD1624294" のようにPD接頭辞付きのため、
    // フォームのPD無し入力とは一致しない（レビューで実データ確認・2026-08-08）。
    const { records } = await getRecords(appId, token, `文字列__1行__0 = "${escapeQuery(pd)}" limit 1`);
    const record = records[0];
    if (!record) return NextResponse.json({ ok: true, found: false, data: null });
    const data: KandenLookup = {
      listName: field(record, "文字列__1行__2"), customerNumber: field(record, "文字列__1行__3"),
      phone: field(record, "文字列__1行__9"), contractNameKanji: field(record, "文字列__1行__4"),
      contractNameKana: field(record, "文字列__1行__5"), postalCode: field(record, "文字列__1行__6"),
      address1: field(record, "文字列__1行__7"), address2: field(record, "文字列__1行__8"),
      leavingDestination: field(record, "文字列__1行__15"), leavingDate: field(record, "日付_0"),
      contractType: field(record, "ドロップダウン_0"), contractCapacityLight: field(record, "数値"),
      contractCapacityPower: field(record, "数値_0"), kandenGasContract: field(record, "ドロップダウン_3"),
      powerContract: field(record, "ドロップダウン_1"), demandStartDate: field(record, "日付"),
      annualUsageLight: field(record, "数値_1"), monthlyUsageLight: field(record, "数値_2"),
      monthlyUsagePower: field(record, "数値_3"),
    };
    return NextResponse.json({ ok: true, found: true, data });
  } catch (error) {
    const result = tossError(error);
    return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
  }
}
