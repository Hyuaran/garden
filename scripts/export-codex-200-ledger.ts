import fs from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { writeFileMakerLedgerBuffer, type FileMakerLedgerSource } from "../src/app/bud/expenses/_lib/filemaker-ledger-export";

async function main() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("bud_expense_requests")
    .select("id,corp_id,applicant_employee_id,receipt_date,store_name,amount,qualified_class,qualified_number,category_id,submitted_at,keiri_checked_at")
    .eq("status", "journalize_pending").is("deleted_at", null).limit(50);
  if (error) throw error;
  const rows = data ?? [];
  const corpIds = Array.from(new Set(rows.map((row) => row.corp_id).filter(Boolean))) as string[];
  const employeeIds = Array.from(new Set(rows.map((row) => row.applicant_employee_id).filter(Boolean))) as string[];
  const categoryIds = Array.from(new Set(rows.map((row) => row.category_id).filter(Boolean))) as string[];
  const [corpRes, employeeRes, categoryRes] = await Promise.all([
    corpIds.length ? admin.from("bud_corporations").select("id,name_short").in("id", corpIds) : Promise.resolve({ data: [] }),
    employeeIds.length ? admin.from("root_employees").select("employee_id,name").in("employee_id", employeeIds) : Promise.resolve({ data: [] }),
    categoryIds.length ? admin.from("bud_expense_categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [] }),
  ]);
  const corps = new Map((corpRes.data ?? []).map((row) => [row.id, row.name_short ?? row.id]));
  const employees = new Map((employeeRes.data ?? []).map((row) => [row.employee_id, row.name ?? row.employee_id]));
  const categories = new Map((categoryRes.data ?? []).map((row) => [row.id, row.name]));
  const sources: FileMakerLedgerSource[] = rows.map((row) => ({
    corpName: row.corp_id ? corps.get(row.corp_id) ?? row.corp_id : "",
    applicantName: row.applicant_employee_id ? employees.get(row.applicant_employee_id) ?? row.applicant_employee_id : "",
    qualifiedClass: row.qualified_class, qualifiedNumber: row.qualified_number,
    categoryName: row.category_id ? categories.get(row.category_id) ?? row.category_id : "",
    receiptDate: row.receipt_date, storeName: row.store_name, amount: row.amount,
    submittedAt: row.submitted_at, submittedByName: "", keiriCheckedAt: row.keiri_checked_at, keiriCheckedByName: "",
    // migration は本番未適用のため、実データ検証では新3列を未入力として出す。
    bookingDate: null, bookingCorpName: null, fiscalPeriod: null,
  }));
  const output = path.resolve("outputs/codex-200/領収書-Garden経費-実データ確認.xlsx");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(await writeFileMakerLedgerBuffer(sources)));
  console.log(JSON.stringify({ output, rows: sources.length }));
}

void main();
