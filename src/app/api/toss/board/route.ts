import { NextResponse } from "next/server";

import { toBoardRow } from "@/app/toss/_lib/board";
import { getRecords } from "@/app/toss/_lib/kintone.server";
import { requireActiveTossPartner, tossError } from "@/app/toss/_lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const partner = await requireActiveTossPartner();
    const mine = new URL(request.url).searchParams.get("mine") === "1";
    const appId = process.env.KINTONE_TOSSUP_APP_ID || "";
    const token = process.env.KINTONE_TOSSUP_TOKEN || "";
    const { records, totalCount } = await getRecords(appId, token, "order by 日付 desc limit 500");
    const rows = records.map(toBoardRow).filter((row) => !mine || row.partnerCode === partner.partner_code);
    return NextResponse.json({ ok: true, rows, mine, limited: Number(totalCount || 0) > records.length });
  } catch (error) {
    const result = tossError(error);
    return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
  }
}
