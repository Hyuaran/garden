import type { SupabaseClient } from "@supabase/supabase-js";

import type { InnoveraCallRaw } from "@/lib/innovera/client";
import { parseInnoveraJst } from "@/lib/innovera/ingest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// WEBインバウンド事業（ヒカリのプロ・電気開始受付センター）の夜間処理に、Garden が写した INNOVERA の通話履歴を渡す（読むだけ）。
//   夜間処理は Vercel から INNOVERA へ直接つなぐと途切れる（2026-10-16〜）ため、ホスト PC 中継で写した system_innovera_call を読む。
//   返す行は INNOVERA の検索の返事 1 件そのまま（raw）。期間の書き方も INNOVERA の検索と同じ（JST の "YYYY-MM-DD HH:MM:SS"・両端を含む）
export const EXPORT_MAX_CIRCUITS = 20;
export const EXPORT_MAX_DAYS = 31;
const PAGE_SIZE = 1000;

export type InnoveraExportParams = { circuits: number[]; from: string; to: string };

export type InnoveraExportResult = {
  rows: InnoveraCallRaw[];
  /** 取り込み（5 分ごと・深夜の読み返し）が最後に成功したときの読み終わりの時刻。これより後の通話はまだ写っていない */
  covered_until: string | null;
  last_success_at: string | null;
};

export function parseExportParams(body: unknown): InnoveraExportParams {
  if (!body || typeof body !== "object") throw new Error("body must be an object");
  const { circuits, from, to } = body as { circuits?: unknown; from?: unknown; to?: unknown };
  if (!Array.isArray(circuits) || circuits.length === 0) throw new Error("circuits must be a non-empty array");
  if (circuits.length > EXPORT_MAX_CIRCUITS) throw new Error(`circuits must contain at most ${EXPORT_MAX_CIRCUITS} items`);
  const ids = circuits.map((value) => Number(value));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("circuits must be positive integers");
  if (typeof from !== "string" || typeof to !== "string") throw new Error("from and to are required");
  const fromIso = parseInnoveraJst(from);
  const toIso = parseInnoveraJst(to);
  if (!fromIso || !toIso) throw new Error('from and to must be "YYYY-MM-DD HH:MM:SS" (JST)');
  const span = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (span < 0) throw new Error("from must not be after to");
  if (span > EXPORT_MAX_DAYS * 24 * 60 * 60 * 1000) throw new Error(`range must be at most ${EXPORT_MAX_DAYS} days`);
  return { circuits: ids, from, to };
}

export async function exportInnoveraCalls(
  params: InnoveraExportParams,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<InnoveraExportResult> {
  const fromIso = parseInnoveraJst(params.from);
  const toIso = parseInnoveraJst(params.to);
  if (!fromIso || !toIso) throw new Error("invalid range");

  const rows: InnoveraCallRaw[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("system_innovera_call")
      .select("raw")
      .in("circuit_id", params.circuits)
      .gte("start_time", fromIso)
      .lte("start_time", toIso)
      .order("start_time", { ascending: true })
      .order("innovera_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`system_innovera_call select failed: ${error.message}`);
    const page = (data ?? []) as { raw: InnoveraCallRaw | null }[];
    for (const row of page) if (row.raw) rows.push(row.raw);
    if (page.length < PAGE_SIZE) break;
  }

  // 取り込みの「どこまで写っているか」は 5 分ごと（poll）と深夜の読み返し（daily）の成功だけで見る（getCronRange と同じ。backfill は過去を読むだけ）
  const { data: log, error: logError } = await supabase
    .from("system_innovera_ingest_log")
    .select("range_to, finished_at")
    .eq("status", "success")
    .in("mode", ["poll", "daily"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ range_to: string | null; finished_at: string | null }>();
  if (logError) throw new Error(`system_innovera_ingest_log select failed: ${logError.message}`);

  return { rows, covered_until: log?.range_to ?? null, last_success_at: log?.finished_at ?? null };
}
