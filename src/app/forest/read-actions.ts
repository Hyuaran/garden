"use server";
import { requireForestDataRead } from "@/lib/auth/leaf-forest-view.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import type { Company, FiscalPeriod, Shinkouki } from "./_constants/companies";
import type { Hankanhi } from "./_lib/types";
import { readViewPermissions } from "@/lib/auth/view-permission.server";
import { effectivePermission } from "@/lib/auth/view-permission";
import { requireLeafForestRead } from "@/lib/auth/leaf-forest-view.server";

// Only these real data screens may request core financial data. A grant on a
// placeholder page must never grant access to another screen's data.
async function authorize(page: string, tab?: string) {
  if (!["forest-dashboard", "forest-shinkouki", "forest-shinkouki-company"].includes(page)) throw new ViewPermissionError("閲覧権限がありません");
  await requireForestDataRead(page, tab);
}
export async function readForestSnapshot(page: string, tab?: string) {
  await authorize(page, tab);
  const db = getSupabaseAdmin();
  const [companies, periods, shinkouki] = await Promise.all([
    db.from("companies").select("*").order("sort_order"),
    page === "forest-dashboard" ? db.from("fiscal_periods").select("*").order("company_id").order("ki") : Promise.resolve({ data: [], error: null }),
    db.from("shinkouki").select("*"),
  ]);
  for (const result of [companies, periods, shinkouki]) if (result.error) throw new Error(result.error.message);
  return { companies: companies.data as Company[], periods: periods.data as FiscalPeriod[], shinkouki: shinkouki.data as Shinkouki[] };
}
export async function readForestHankanhi(page: string, tab: string | undefined, companyId: string, ki: number) {
  if (page !== "forest-dashboard" || tab !== "matrix") throw new ViewPermissionError("閲覧権限がありません");
  await authorize(page, tab);
  if (!companyId || !Number.isInteger(ki) || ki < 1) throw new Error("対象の期が不正です");
  const { data, error } = await getSupabaseAdmin().from("forest_hankanhi").select("*").eq("company_id", companyId).eq("ki", ki).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Hankanhi | null;
}
export async function readForestJournalMasters(page: string, corpId?: string) {
  if (!["forest-journal", "forest-journal-company"].includes(page)) throw new ViewPermissionError("閲覧権限がありません");
  const context = await requireLeafForestRead(page);
  // Preserve the old RLS result without a setting; use the privileged reader
  // only after an explicit scope grant has been checked.
  const db = effectivePermission(await readViewPermissions(), page) ? getSupabaseAdmin() : context.db;
  if (page === "forest-journal") {
    const { data, error } = await db.from("bud_corporations").select("id,code,name_full,name_short,sort_order,established_on").eq("is_active", true).order("established_on", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { corps: data ?? [] };
  }
  if (!corpId) throw new Error("法人を指定してください");
  const [corp, accounts] = await Promise.all([
    db.from("bud_corporations").select("id,code,name_full,name_short").eq("id", corpId).maybeSingle(),
    db.from("root_bank_accounts").select("id,bank_code,bank_name,branch_name,account_number,sub_account_label,manual_balance_20260430,has_csv_export,notes").eq("corp_code", corpId).eq("is_active", true).is("deleted_at", null).order("bank_code"),
  ]);
  if (corp.error || accounts.error) throw new Error(corp.error?.message ?? accounts.error!.message);
  return { corp: corp.data, accounts: accounts.data ?? [] };
}
