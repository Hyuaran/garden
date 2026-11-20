import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  indexPaymentOrders, isStatementFile, matchPayment, parseStatementRow, statementColumns, statementMonth,
  STATEMENT_SHEET, type MatchOrder, type StatementRow,
} from "./import-statements.core";

async function findFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(path));
    else if (entry.isFile() && isStatementFile(path)) files.push(path);
  }
  return files;
}

async function readFile(path: string, rows: Map<string, StatementRow>) {
  const month = statementMonth(path);
  if (!month) throw new Error("対象ファイル名から明細月を読み取れません。");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path).catch(() => { throw new Error("Excel ファイルを読み込めません。"); });
  const sheet = workbook.getWorksheet(STATEMENT_SHEET);
  if (!sheet) throw new Error("業務委託のシートが見つかりません。");
  const columns = statementColumns(sheet.getRow(1).values as unknown[]);
  let count = 0;
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    try {
      const payment = parseStatementRow(row.values as unknown[], columns, month, path, workbook.properties.date1904);
      if (!payment) return;
      count++;
      const previous = rows.get(payment.pd_row_no);
      if (!previous || previous.statement_month < month) rows.set(payment.pd_row_no, payment);
      else if (previous.statement_month === month) {
        const { source_file: previousFile, ...previousFields } = previous;
        const { source_file: currentFile, ...currentFields } = payment;
        if (JSON.stringify(previousFields) !== JSON.stringify(currentFields)) {
          throw new Error("同じ月の同じ No. に異なる明細があります。");
        }
        if ((currentFile ?? "") < (previousFile ?? "")) rows.set(payment.pd_row_no, payment);
      }
    } catch (error) {
      throw new Error(`明細 ${index} 行目：${error instanceof Error ? error.message : "読み取りに失敗しました。"}`);
    }
  });
  return count;
}

function logMatchCounts(counts: { customer: number; number: number; date: number }) {
  console.log("門標で一致 %d 行、管理番号で一致 %d 行、受注日で絞った %d 行。", counts.customer, counts.number, counts.date);
}

async function main() {
  const { values } = parseArgs({
    options: { dir: { type: "string" }, file: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  if (!!values.dir === !!values.file) throw new Error("--dir と --file のどちらか一方を指定してください。");
  const files = values.dir ? await findFiles(values.dir) : [values.file!].filter(isStatementFile);
  files.sort();
  if (!files.length) {
    console.log("対象ファイル 0 件、明細 0 行、照合済み 0 行、未照合 0 行。");
    if (values["dry-run"]) logMatchCounts({ customer: 0, number: 0, date: 0 });
    return;
  }
  const rows = new Map<string, StatementRow>();
  let read = 0;
  for (const path of files) read += await readFile(path, rows);

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("照合に必要な Supabase の接続設定がありません。");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const orders: MatchOrder[] = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db.from("leaf_kanden_orders")
      .select("id,kanri_no_raw,ordered_on,denki_customer_no,douryoku_customer_no,gas_customer_no,contract_type,power_apply,has_denki,has_douryoku,has_gas")
      .order("id").range(start, start + pageSize - 1);
    if (error) throw new Error("受注の読み取りに失敗しました。");
    orders.push(...data);
    if (data.length < pageSize) break;
  }

  const orderIndex = indexPaymentOrders(orders);
  const counts = { customer: 0, number: 0, date: 0 };
  const reasons = new Map<string, number>();
  const payments = [...rows.values()].map(row => {
    const { matched_by, narrowed_by_date, ...match } = matchPayment(row, orderIndex);
    if (matched_by) counts[matched_by]++;
    if (narrowed_by_date) counts.date++;
    if (match.match_note) reasons.set(match.match_note, (reasons.get(match.match_note) ?? 0) + 1);
    return { ...row, ...match };
  });
  if (!values["dry-run"]) {
    for (let offset = 0; offset < payments.length; offset += 500) {
      const { error } = await db.rpc("leaf_kanden_import_payments", { p_rows: payments.slice(offset, offset + 500) });
      if (error) throw new Error(`明細の保存に失敗しました。保存済み ${offset} 行。`);
    }
  }
  const unmatched = [...reasons.values()].reduce((sum, count) => sum + count, 0);
  console.log(`${values["dry-run"] ? "確認" : "取り込み"}完了：${files.length} ファイル、読み取り ${read} 行、No. 重複除外後 ${payments.length} 行、照合済み ${payments.length - unmatched} 行、未照合 ${unmatched} 行。`);
  if (values["dry-run"]) logMatchCounts(counts);
  for (const [reason, count] of reasons) console.log(`${reason}：${count} 行`);
}

main().catch(error => {
  console.error(error instanceof Error && !("code" in error) ? error.message : "入金明細の処理に失敗しました。");
  process.exitCode = 1;
});
