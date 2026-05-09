/**
 * Garden-Soil Phase B-01 Phase 2: CSV Importer orchestrator
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §4.1
 *
 * 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
 *
 * 役割:
 *   FileMaker CSV → Transform → Load の Phase 2 パイプライン orchestrator。
 *   chunk size = 10,000 件単位で trx 制御（spec §4.3）。
 *   chunk 失敗時は continue、成功 chunk のみ集計。
 *
 *   Phase 1 の runSoilImport（Kintone API 経由）と並行する CSV 経由版。
 *
 * 設計方針:
 *   - 関数ベース、Supabase / CSV stream を依存性注入
 *   - chunk 単位で soil_list_imports.chunks_completed を更新（resume 用）
 *   - 失敗時は throw せず結果オブジェクトに集計
 *   - 既存 loadNormalizedToSoilLists（Phase 1）を再利用
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileMakerCsvRow } from "./soil-import-csv-source";
import { transformFileMakerCsvToSoilList } from "./soil-import-csv-source";
import { loadNormalizedToSoilLists } from "./soil-import-load";

// ============================================================
// 型定義
// ============================================================

export type RunCsvImportInput = {
  supabase: SupabaseClient;
  /** FileMaker CSV 1 行ずつ yield する async iterable（streamCsvRows / parseCsvLines 由来想定） */
  csvRows: AsyncIterable<FileMakerCsvRow>;
  importJobId: string;
  chunkSize: number;
};

export type CsvImportResult = {
  totalChunks: number;
  totalSucceeded: number;
  totalFailed: number;
  errorMessages: string[];
};

// ============================================================
// 純粋ヘルパー: 単行 stream → chunkSize batches
// ============================================================

/**
 * 1 行ずつの AsyncIterable<T> を chunkSize 件単位の batch に再分割する。
 *
 * @param source     上流の single-row stream（CSV パーサ等）
 * @param chunkSize  下流に渡す chunk のサイズ
 */
export function bufferRowsIntoChunks<T>(
  source: AsyncIterable<T>,
  chunkSize: number,
): AsyncIterable<T[]> {
  if (chunkSize <= 0) {
    throw new Error(`chunkSize must be > 0 (got ${chunkSize})`);
  }
  return bufferRowsIntoChunksImpl(source, chunkSize);
}

async function* bufferRowsIntoChunksImpl<T>(
  source: AsyncIterable<T>,
  chunkSize: number,
): AsyncIterable<T[]> {
  const buffer: T[] = [];
  for await (const item of source) {
    buffer.push(item);
    if (buffer.length >= chunkSize) {
      yield buffer.splice(0, chunkSize);
    }
  }
  if (buffer.length > 0) yield buffer;
}

// ============================================================
// メイン: runSoilImportFromCsv
// ============================================================

/**
 * FileMaker CSV からのリストインポートを Transform → Load で完走させる。
 *
 * フロー:
 *   1. csvRows（FileMakerCsvRow async iterable）を chunkSize 件単位に再分割
 *   2. 各 chunk を transformFileMakerCsvToSoilList で変換
 *   3. loadNormalizedToSoilLists で soil_lists へ upsert
 *   4. chunk 完了毎に soil_list_imports.chunks_completed を更新
 *   5. 完走時に soil_list_imports.job_status='completed' / completed_at を更新
 *
 * @returns CsvImportResult（throw しない）
 */
export async function runSoilImportFromCsv(
  input: RunCsvImportInput,
): Promise<CsvImportResult> {
  const { supabase, csvRows, importJobId, chunkSize } = input;

  if (chunkSize <= 0) {
    throw new Error(`chunkSize must be > 0 (got ${chunkSize})`);
  }

  let totalChunks = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  const errorMessages: string[] = [];

  const startedAt = new Date().toISOString();

  for await (const chunk of bufferRowsIntoChunks(csvRows, chunkSize)) {
    totalChunks += 1;
    const chunkId = totalChunks;

    const normalizedRecords = chunk.map(transformFileMakerCsvToSoilList);

    const loadResult = await loadNormalizedToSoilLists({
      supabase,
      records: normalizedRecords,
      importJobId,
      chunkId,
    });

    totalSucceeded += loadResult.succeeded;
    totalFailed += loadResult.failed;
    errorMessages.push(...loadResult.errorMessages);

    // 進捗更新: chunk 完了毎
    await supabase
      .from("soil_list_imports")
      .update({
        chunks_completed: chunkId,
        last_chunk_completed_at: new Date().toISOString(),
        job_status: "running",
      })
      .eq("id", importJobId);
  }

  // 完走更新
  await supabase
    .from("soil_list_imports")
    .update({
      job_status: "completed",
      completed_at: new Date().toISOString(),
      started_at: startedAt,
      chunks_total: totalChunks,
      chunks_completed: totalChunks,
      total_records: totalSucceeded + totalFailed,
      inserted_count: totalSucceeded,
      failed_count: totalFailed,
    })
    .eq("id", importJobId);

  return {
    totalChunks,
    totalSucceeded,
    totalFailed,
    errorMessages,
  };
}
