import { NextResponse } from "next/server";

import { toBoardRow } from "@/app/p/toss/_lib/board";
import { getRecords } from "@/app/p/toss/_lib/kintone.server";
import { requirePartnerOrStaff, tossError } from "@/app/p/_lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await requirePartnerOrStaff();
    const mineParam = new URL(request.url).searchParams.get("mine");
    const appId = process.env.KINTONE_TOSSUP_APP_ID || "";
    const token = process.env.KINTONE_TOSSUP_TOKEN || "";
    const { records, totalCount } = await getRecords(appId, token, "order by 日付 desc limit 500");
    const effectiveMine = access.kind === "partner" && (mineParam === null || mineParam === "1");
    const rows = records.map(toBoardRow).filter((row) => !effectiveMine || row.partnerCode === access.partnerCode);
    return NextResponse.json({ ok: true, rows, mine: effectiveMine, sessionKind: access.kind, limited: Number(totalCount || 0) > records.length });
  } catch (error) {
    const result = tossError(error);
    return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
  }
}
