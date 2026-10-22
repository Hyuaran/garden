import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { exportInnoveraCalls, parseExportParams, type InnoveraExportParams } from "@/lib/innovera/export.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * WEBインバウンド事業（hikari-pro-lp の夜間処理）が、Garden の写した INNOVERA の通話履歴を読む入口（読むだけ・2026-10-22）。
 * 鍵＝Bearer WEB_INBOUND_EXPORT_SECRET（hikari-pro-lp の Vercel にも同じ値）。
 * 本文＝{ circuits: [回線ID…], from: "YYYY-MM-DD HH:MM:SS", to: "…" }（JST・両端を含む＝INNOVERA の検索と同じ書き方）
 * 返り＝{ ok, rows: [INNOVERA の検索の返事 1 件そのまま…], covered_until, last_success_at }
 */
export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "WEB_INBOUND_EXPORT_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let params: InnoveraExportParams;
  try {
    params = parseExportParams(await request.json());
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid request",
    }, { status: 400 });
  }

  try {
    const result = await exportInnoveraCalls(params);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[innovera-calls/export] failed", error);
    return NextResponse.json({ ok: false, error: "通話履歴を読めませんでした" }, { status: 500 });
  }
}
