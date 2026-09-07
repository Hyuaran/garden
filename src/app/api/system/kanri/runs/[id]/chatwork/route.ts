import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { sendKanriReportMessage } from "@/app/system/_lib/chatwork";
import { buildKanriChatworkMessage } from "@/app/system/kanri/_lib/chatwork-message";
import type { KanriMode, KanriSummary } from "@/app/system/kanri/_lib/kanri-core";
import type { KanriSheetGrid } from "@/app/system/kanri/_lib/calc/kanri-sheet";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RunRow = {
  id: string;
  target_date: string;
  mode: KanriMode;
  creator_name: string | null;
  summary: KanriSummary | null;
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const [runResult, resultResult] = await Promise.all([
    admin
      .from("system_kanri_run")
      .select("id,target_date,mode,creator_name,summary")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("system_kanri_result")
      .select("grid,calculated_at")
      .eq("run_id", id)
      .eq("sheet", "kanri")
      .maybeSingle(),
  ]);

  if (runResult.error || resultResult.error) {
    console.error("[system/kanri/chatwork] failed to load report", {
      runError: Boolean(runResult.error),
      resultError: Boolean(resultResult.error),
    });
    return NextResponse.json({ ok: false, error: "Chatwork に送れませんでした。管理者へ問い合わせてください" }, { status: 500 });
  }
  if (!runResult.data) {
    return NextResponse.json({ ok: false, error: "取り込み結果が見つかりません" }, { status: 404 });
  }
  if (!resultResult.data?.grid) {
    return NextResponse.json({ ok: false, error: "先に「計算する」を押してください" }, { status: 400 });
  }

  const run = runResult.data as RunRow;
  const grid = resultResult.data.grid as KanriSheetGrid;
  const text = buildKanriChatworkMessage({
    targetDate: String(run.target_date),
    mode: run.mode,
    creatorName: String(run.creator_name ?? manager.name ?? ""),
    grid,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });

  let sent;
  try {
    sent = await sendKanriReportMessage(text);
  } catch (error) {
    console.error("[system/kanri/chatwork] send failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ ok: false, error: "Chatwork に送れませんでした。管理者へ問い合わせてください" }, { status: 500 });
  }

  const chatwork = {
    sentAt: new Date().toISOString(),
    roomId: sent.roomId,
    by: String(manager.name ?? run.creator_name ?? ""),
  };
  const summary = { ...(run.summary ?? {}), chatwork } as KanriSummary;
  const { error: updateError } = await admin
    .from("system_kanri_run")
    .update({ summary, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    console.error("[system/kanri/chatwork] failed to save delivery record");
    return NextResponse.json({ ok: false, error: "Chatwork に送れませんでした。管理者へ問い合わせてください" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chatwork });
}
