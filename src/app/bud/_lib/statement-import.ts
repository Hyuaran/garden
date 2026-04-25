import { supabase } from "./supabase";
import {
  parseStatementCsv,
  type StatementSourceType,
  type ParsedStatementRow,
} from "./statement-csv-parser";
import {
  bulkMatch,
  type MatchableStatement,
  type MatchableTransfer,
} from "./statement-matcher";
import { fetchMatchableTransfers } from "./statement-queries";
import { transitionTransferStatus } from "./transfer-mutations";

export interface ImportResult {
  success: boolean;
  batchId?: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  autoMatchedCount: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

export interface ImportParams {
  bankAccountId: string;
  sourceType: StatementSourceType;
  fileName: string;
  csvText: string;
  importedBy: string;
}

export async function importBankStatements(
  params: ImportParams,
): Promise<ImportResult> {
  const parsed = parseStatementCsv(params.csvText, params.sourceType);
  const rowCount = parsed.rows.length + parsed.errors.length;
  const errorCount = parsed.errors.length;

  if (parsed.rows.length === 0) {
    return {
      success: false,
      rowCount,
      successCount: 0,
      errorCount,
      skippedCount: 0,
      autoMatchedCount: 0,
      errors: parsed.errors.map((e) => ({
        rowIndex: e.rowIndex,
        message: e.message,
      })),
    };
  }

  // 1. バッチヘッダー作成
  const { data: batchRow, error: batchErr } = await supabase
    .from("bud_statement_import_batches")
    .insert({
      bank_account_id: params.bankAccountId,
      source_type: params.sourceType,
      file_name: params.fileName,
      row_count: rowCount,
      success_count: 0,
      error_count: errorCount,
      skipped_count: 0,
      auto_matched_count: 0,
      imported_by: params.importedBy,
      status: "completed",
    })
    .select("id")
    .single<{ id: string }>();

  if (batchErr || !batchRow) {
    return {
      success: false,
      rowCount,
      successCount: 0,
      errorCount: errorCount + 1,
      skippedCount: 0,
      autoMatchedCount: 0,
      errors: [
        {
          rowIndex: -1,
          message: `バッチ記録に失敗: ${batchErr?.message ?? "unknown"}`,
        },
      ],
    };
  }
  const batchId = batchRow.id;

  // 2. 明細を upsert（重複は ignoreDuplicates で自動スキップ）
  const insertRows = parsed.rows.map((r) =>
    toInsertRow(r, params.bankAccountId, params.sourceType, batchId),
  );

  const { data: inserted, error: insertErr } = await supabase
    .from("bud_statements")
    .upsert(insertRows, {
      onConflict:
        "bank_account_id,transaction_date,transaction_time,amount,description",
      ignoreDuplicates: true,
    })
    .select("id, transaction_date, amount, description");

  const successCount = inserted?.length ?? 0;
  const skippedCount = parsed.rows.length - successCount;

  if (insertErr && successCount === 0) {
    await supabase
      .from("bud_statement_import_batches")
      .update({
        status: "failed",
        error_summary: insertErr.message.substring(0, 500),
        success_count: 0,
        skipped_count: 0,
      })
      .eq("id", batchId);
    return {
      success: false,
      batchId,
      rowCount,
      successCount: 0,
      errorCount: errorCount + 1,
      skippedCount: 0,
      autoMatchedCount: 0,
      errors: [
        ...parsed.errors.map((e) => ({
          rowIndex: e.rowIndex,
          message: e.message,
        })),
        { rowIndex: -1, message: `INSERT に失敗: ${insertErr.message}` },
      ],
    };
  }

  // 3. 自動照合
  let autoMatchedCount = 0;
  if (inserted && inserted.length > 0) {
    autoMatchedCount = await runAutoMatch(inserted as InsertedStatement[]);
  }

  // 4. バッチ統計更新
  await supabase
    .from("bud_statement_import_batches")
    .update({
      success_count: successCount,
      skipped_count: skippedCount,
      auto_matched_count: autoMatchedCount,
      status: errorCount > 0 ? "partial" : "completed",
    })
    .eq("id", batchId);

  return {
    success: true,
    batchId,
    rowCount,
    successCount,
    errorCount,
    skippedCount,
    autoMatchedCount,
    errors: parsed.errors.map((e) => ({
      rowIndex: e.rowIndex,
      message: e.message,
    })),
  };
}

interface InsertedStatement {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
}

function toInsertRow(
  row: ParsedStatementRow,
  bankAccountId: string,
  sourceType: StatementSourceType,
  batchId: string,
) {
  return {
    bank_account_id: bankAccountId,
    transaction_date: row.transaction_date,
    transaction_time: row.transaction_time,
    amount: row.amount,
    balance_after: row.balance_after,
    description: row.description,
    transaction_type: row.transaction_type,
    source_type: sourceType,
    imported_batch_id: batchId,
    raw_row: row.raw_row,
  };
}

async function runAutoMatch(
  inserted: InsertedStatement[],
): Promise<number> {
  const candidates = await fetchMatchableTransfers().catch(() => [] as MatchableTransfer[]);
  if (candidates.length === 0) return 0;

  const statements: MatchableStatement[] = inserted.map((r) => ({
    transaction_date: r.transaction_date,
    amount: r.amount,
    description: r.description,
  }));

  const summary = bulkMatch(statements, candidates);
  let matchedCount = 0;

  for (const m of summary.matched) {
    const stmt = inserted[m.statementIndex];
    const { error } = await supabase
      .from("bud_statements")
      .update({
        matched_transfer_id: m.result.transferId,
        match_confidence: m.result.confidence,
        matched_at: new Date().toISOString(),
      })
      .eq("id", stmt.id);
    if (error) continue;

    // 振込側を 振込完了 に遷移（best-effort、失敗してもスキップ）
    const transitionResult = await transitionTransferStatus({
      transferId: m.result.transferId,
      toStatus: "振込完了",
    });
    if (transitionResult.success) {
      matchedCount++;
    }
  }

  return matchedCount;
}
