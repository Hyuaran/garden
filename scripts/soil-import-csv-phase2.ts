/**
 * Garden-Soil Phase B-01 Phase 2: FileMaker CSV インポート 実行スクリプト
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md
 *
 * 実行例:
 *   npx tsx scripts/soil-import-csv-phase2.ts \
 *     "C:\garden\imports\filemaker-list-export-20260513-2200.csv" \
 *     "<import-job-id-uuid>" \
 *     [chunkSize=10000]
 *
 * 前提:
 *   - 環境変数: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 設定済
 *   - migrations 20260507000007 (soil_imports_staging) apply 済
 *   - import job レコード（soil_list_imports に source_system='filemaker-list2024' で先行 INSERT 済）
 *
 * 動作:
 *   1. CSV ファイルを fs.createReadStream + readline でストリーミング読込（200 万件対応）
 *   2. parseCsvLines で 1 行ずつ FileMakerCsvRow に変換（BOM 自動除去 / quotes 対応）
 *   3. runSoilImportFromCsv で chunkSize 件単位に Transform → Load
 *   4. 完走時に成功/失敗集計を stdout に出力
 *
 * エラー処理:
 *   - chunk 失敗は continue（全 chunk 完走を最優先）
 *   - 致命的エラー（ファイル open 失敗 / Supabase 接続不能等）は throw + exit code 1
 *
 * 注意:
 *   - 200 万件取込中は INDEX OFF 推奨（spec §6 参照）
 *   - 取込時間帯は Tree 営業時間外（22:00-7:00 推奨、spec §10.2）
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseCsvLines } from "@/lib/db/soil-csv-parser";
import { runSoilImportFromCsv } from "@/lib/db/soil-csv-importer";
import type { FileMakerCsvRow } from "@/lib/db/soil-import-csv-source";

// ============================================================
// メイン
// ============================================================

async function main(): Promise<void> {
  const [, , filePath, importJobId, chunkSizeStr] = process.argv;

  if (!filePath || !importJobId) {
    console.error(
      "Usage: tsx scripts/soil-import-csv-phase2.ts <csv-path> <import-job-id> [chunkSize=10000]",
    );
    process.exit(1);
  }

  const chunkSize = chunkSizeStr ? Number.parseInt(chunkSizeStr, 10) : 10_000;
  if (Number.isNaN(chunkSize) || chunkSize <= 0) {
    console.error(`Invalid chunkSize: ${chunkSizeStr}`);
    process.exit(1);
  }

  console.log("[soil-import-csv-phase2] start");
  console.log(`  file:        ${filePath}`);
  console.log(`  importJobId: ${importJobId}`);
  console.log(`  chunkSize:   ${chunkSize}`);
  console.log(`  startedAt:   ${new Date().toISOString()}`);

  const supabase = getSupabaseAdmin();

  // ファイル → 行 stream
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });

  // CSV パース → FileMakerCsvRow yield
  // parseCsvLines は Record<string, string> を返す。FileMakerCsvRow は Record<string, string | undefined> 互換。
  const csvRows = parseCsvLines(rl) as AsyncGenerator<FileMakerCsvRow>;

  // Transform → Load
  const result = await runSoilImportFromCsv({
    supabase,
    csvRows,
    importJobId,
    chunkSize,
  });

  console.log("[soil-import-csv-phase2] done");
  console.log(`  totalChunks:    ${result.totalChunks}`);
  console.log(`  totalSucceeded: ${result.totalSucceeded}`);
  console.log(`  totalFailed:    ${result.totalFailed}`);
  console.log(`  finishedAt:     ${new Date().toISOString()}`);

  if (result.errorMessages.length > 0) {
    console.warn("[soil-import-csv-phase2] errors (max 5 shown):");
    for (const msg of result.errorMessages.slice(0, 5)) {
      console.warn(`  - ${msg}`);
    }
  }

  // 失敗があっても exit code 0（完走優先）。
  // 致命的エラー時のみ throw でこの行に到達せず exit 1。
}

main().catch((err) => {
  console.error("[soil-import-csv-phase2] fatal:", err);
  process.exit(1);
});
