import { NextResponse } from "next/server";

import { queryPg } from "@/lib/db/pg";

import { requireSoilListUser } from "../_lib/auth";
import { buildHistorySql, CURRENT_HISTORY_SQL, type SoilListHistoryCurrent, type SoilListHistoryRow } from "../_lib/history-sql";
import { normalizePhone } from "../_lib/upload-parser";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  const phone = normalizePhone(new URL(request.url).searchParams.get("phone") ?? "");
  if (phone.length < 9) return NextResponse.json({ ok: false, error: "電話番号の形が違います" }, { status: 400 });

  try {
    const [currentResult, historyResult] = await Promise.all([
      queryPg<SoilListHistoryCurrent>(CURRENT_HISTORY_SQL, [phone]),
      queryPg<SoilListHistoryRow>(buildHistorySql(), [phone]),
    ]);
    const omitted = historyResult.rows.length > 500;
    return NextResponse.json({
      ok: true,
      current: currentResult.rows[0] ?? null,
      rows: historyResult.rows.slice(0, 500),
      omitted,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "履歴を取得できませんでした" }, { status: 500 });
  }
}
