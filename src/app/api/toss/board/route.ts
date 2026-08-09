import { NextResponse } from "next/server";

import { toBoardRow } from "@/app/p/toss/_lib/board";
import { getAllRecords, getRecords } from "@/app/p/toss/_lib/kintone.server";
import { requirePartnerOrStaff, tossError } from "@/app/p/_lib/server-auth";

export const runtime = "nodejs";

async function getKandenPartnerCodes() {
  const appId = process.env.KINTONE_DIVISION_ROSTER_APP_ID || "";
  const token = process.env.KINTONE_DIVISION_ROSTER_TOKEN || "";
  const { records } = await getRecords(appId, token, 'ドロップダウン_2 in ("関電トス") limit 500');
  return new Set(records.map((record) => {
    const value = record.数値?.value;
    return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  }).filter(Boolean));
}

export async function GET(request: Request) {
  try {
    const access = await requirePartnerOrStaff();
    const mineParam = new URL(request.url).searchParams.get("mine");
    const appId = process.env.KINTONE_TOSSUP_APP_ID || "";
    const token = process.env.KINTONE_TOSSUP_TOKEN || "";
    const records = await getAllRecords(appId, token);
    let kandenPartnerCodes: Set<string> | null = null;
    try {
      kandenPartnerCodes = await getKandenPartnerCodes();
    } catch (error) {
      console.warn("[toss/board] 関電トス名簿を取得できないため、名簿フィルターなしで返します", error);
    }
    const effectiveMine = access.kind === "partner" && (mineParam === null || mineParam === "1");
    const rows = records.map(toBoardRow).filter((row) => {
      const isKandenPartner = kandenPartnerCodes === null || kandenPartnerCodes.has(row.partnerCode.trim());
      return isKandenPartner && (!effectiveMine || row.partnerCode === access.partnerCode);
    }).sort((a, b) => b.introducedAt.localeCompare(a.introducedAt));
    return NextResponse.json({ ok: true, rows, mine: effectiveMine, sessionKind: access.kind, limited: false });
  } catch (error) {
    const result = tossError(error);
    return NextResponse.json({ ok: false, error: result.message }, { status: result.status });
  }
}
