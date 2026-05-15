/**
 * Garden-Soil Phase B-01: normalized → soil_lists Load 段階
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §3.3 staging 方式）
 *   - docs/specs/2026-04-25-soil-04-import-strategy.md（#04 インポート戦略）
 *
 * 作成: 2026-05-08（Phase B-01 第 2 弾、a-soil）
 *
 * 役割:
 *   Transform 段階で生成された SoilListInsert 配列を soil_lists へ
 *   ON CONFLICT (source_system, source_record_id) DO UPDATE で upsert する。
 *
 *   chunk size = 5,000 件 / 1 trx は呼出側で制御（本関数は受け取った records を一括 upsert）。
 *
 * 設計方針:
 *   - Supabase client を引数注入（テスト時はモック）
 *   - エラー発生時は soil_imports_errors に詳細を記録（最大 100 件）
 *   - throw せず、結果オブジェクトで成功/失敗を返却（呼出側で chunk continue 判断）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SoilListInsert } from "./soil-types";

// ============================================================
// 型定義
// ============================================================

export type LoadInput = {
  supabase: SupabaseClient;
  records: SoilListInsert[];
  importJobId: string;
  chunkId: number;
};

export type LoadResult = {
  total: number;
  succeeded: number;
  failed: number;
  soilListIds: string[];
  errorMessages: string[];
};

export type LoadFailure = {
  sourceRecordId: string | null;
  message: string;
};

export type SoilImportErrorRow = {
  import_job_id: string;
  chunk_id: number;
  source_record_id: string | null;
  error_phase: "extract" | "transform" | "load";
  error_type: string;
  error_message: string;
  error_details: Record<string, unknown> | null;
};

// ============================================================
// 純粋ヘルパー: 失敗 → soil_imports_errors INSERT 行
// ============================================================

/**
 * Load 段階の失敗レコードを soil_imports_errors テーブル INSERT 行に変換する純粋関数。
 */
export function buildErrorRecords(input: {
  importJobId: string;
  chunkId: number;
  failures: LoadFailure[];
}): SoilImportErrorRow[] {
  return input.failures.map((f) => ({
    import_job_id: input.importJobId,
    chunk_id: input.chunkId,
    source_record_id: f.sourceRecordId,
    error_phase: "load",
    error_type: "load_failure",
    error_message: f.message,
    error_details: null,
  }));
}

// ============================================================
// メイン関数: normalized → soil_lists upsert
// ============================================================

/**
 * 正規化済 SoilListInsert 配列を soil_lists へ upsert する。
 *
 * 動作:
 *   1. records が空なら no-op で 0/0/0 返却
 *   2. ON CONFLICT (source_system, source_record_id) DO UPDATE で一括 upsert
 *   3. 成功時: 返却 data から id を集約、succeeded カウント
 *   4. 失敗時: error メッセージを soil_imports_errors に書込、failed カウント
 *   5. 結果オブジェクト返却（throw しない）
 *
 * @param input.supabase     Supabase クライアント（service_role 想定で RLS バイパス）
 * @param input.records      Transform 済 SoilListInsert 配列
 * @param input.importJobId  soil_list_imports.id（エラー追跡用）
 * @param input.chunkId      chunk 番号（5,000 件単位、エラー追跡用）
 */
export async function loadNormalizedToSoilLists(
  input: LoadInput,
): Promise<LoadResult> {
  const { supabase, records, importJobId, chunkId } = input;

  if (records.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      soilListIds: [],
      errorMessages: [],
    };
  }

  const upsertResult = await supabase
    .from("soil_lists")
    .upsert(records, {
      onConflict: "source_system,source_record_id",
      ignoreDuplicates: false,
    })
    .select();

  // upsertResult: { data: { id: string }[] | null, error: { message } | null }
  const data = (upsertResult as { data: { id: string }[] | null }).data;
  const error = (upsertResult as { error: { message: string } | null }).error;

  if (error) {
    // 全件失敗扱い: 各レコードを errors に記録
    const failures: LoadFailure[] = records.map((r) => ({
      sourceRecordId: r.source_record_id,
      message: error.message,
    }));

    const errorRows = buildErrorRecords({ importJobId, chunkId, failures });
    if (errorRows.length > 0) {
      await supabase.from("soil_imports_errors").insert(errorRows);
    }

    return {
      total: records.length,
      succeeded: 0,
      failed: records.length,
      soilListIds: [],
      errorMessages: [error.message],
    };
  }

  const soilListIds = (data ?? []).map((row) => row.id);
  return {
    total: records.length,
    succeeded: soilListIds.length,
    failed: records.length - soilListIds.length,
    soilListIds,
    errorMessages: [],
  };
}
