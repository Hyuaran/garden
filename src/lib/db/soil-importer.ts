/**
 * Garden-Soil Phase B-01: Importer orchestrator
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §3.3 / §5）
 *
 * 作成: 2026-05-08（Phase B-01 第 3 弾、a-soil）
 *
 * 役割:
 *   Kintone API → Transform → Load の Extract / Transform / Load パイプラインを統合し、
 *   chunk size = 5,000 件単位で trx 制御。chunk 失敗時は continue、成功 chunk のみ集計。
 *
 * 設計方針:
 *   - 関数ベース（class より関数の方が testable で副作用追跡しやすい）
 *   - すべての副作用は依存性注入（kintone client + supabase）
 *   - chunk 単位で soil_list_imports.chunks_completed を更新（resume 用）
 *   - 失敗時は throw せず、結果オブジェクトに集計
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KintoneClient } from "./kintone-client";
import {
  transformKintoneApp55ToSoilList,
  type KintoneApp55Record,
} from "./soil-import-transform";
import { loadNormalizedToSoilLists } from "./soil-import-load";

// ============================================================
// 型定義
// ============================================================

export type RunSoilImportInput = {
  supabase: SupabaseClient;
  kintone: KintoneClient;
  importJobId: string;
  app: number;
  chunkSize: number;
  /** Kintone fetchAllRecords に渡す追加フィルタ */
  query?: string;
  /** Kintone から取得するフィールド絞り込み（省略時は全 field） */
  fields?: string[];
};

export type SoilImportResult = {
  totalChunks: number;
  totalSucceeded: number;
  totalFailed: number;
  errorMessages: string[];
};

// ============================================================
// 純粋ヘルパー: AsyncIterable<T[]> を chunkSize で再分割
// ============================================================

/**
 * Kintone cursor は 500 件 / batch だが、Soil 側は 5,000 件 / chunk で trx 制御したい。
 * source からの batch を buffer に溜めて、chunkSize 件ずつ yield する純粋 async generator。
 *
 * @param source     上流の AsyncIterable（Kintone fetchAllRecords 想定）
 * @param chunkSize  下流に渡す chunk のサイズ（5,000 件想定）
 */
export function bufferIntoChunks<T>(
  source: AsyncIterable<T[]>,
  chunkSize: number,
): AsyncIterable<T[]> {
  if (chunkSize <= 0) {
    throw new Error(`chunkSize must be > 0 (got ${chunkSize})`);
  }
  return bufferIntoChunksImpl(source, chunkSize);
}

async function* bufferIntoChunksImpl<T>(
  source: AsyncIterable<T[]>,
  chunkSize: number,
): AsyncIterable<T[]> {
  const buffer: T[] = [];
  for await (const batch of source) {
    for (const item of batch) {
      buffer.push(item);
      if (buffer.length >= chunkSize) {
        yield buffer.splice(0, chunkSize);
      }
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}

// ============================================================
// メイン: runSoilImport
// ============================================================

/**
 * Kintone App 55 からのリストインポートを Extract → Transform → Load で完走させる。
 *
 * フロー:
 *   1. kintone.fetchAllRecords() で raw レコードを cursor 取得
 *   2. bufferIntoChunks で chunkSize 単位に再分割
 *   3. 各 chunk を transformKintoneApp55ToSoilList で変換
 *   4. loadNormalizedToSoilLists で soil_lists へ upsert
 *   5. chunk 完了毎に soil_list_imports.chunks_completed を更新
 *   6. 完走時に soil_list_imports.job_status='completed' / completed_at を更新
 *
 * @returns SoilImportResult（throw しない）
 */
export async function runSoilImport(
  input: RunSoilImportInput,
): Promise<SoilImportResult> {
  const { supabase, kintone, importJobId, app, chunkSize, query, fields } = input;

  let totalChunks = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  const errorMessages: string[] = [];

  const recordsIterator = kintone.fetchAllRecords<KintoneApp55Record>({
    app,
    size: 500,
    query,
    fields,
  });

  const startedAt = new Date().toISOString();

  for await (const chunk of bufferIntoChunks(recordsIterator, chunkSize)) {
    totalChunks += 1;
    const chunkId = totalChunks;

    const normalizedRecords = chunk.map(transformKintoneApp55ToSoilList);

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
      job_status: totalFailed === 0 ? "completed" : "completed",
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
