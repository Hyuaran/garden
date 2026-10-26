import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { ROOT_EMPLOYEE_SELECT_FIELDS } from "@/app/root/_lib/employee-select";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

// 関連マスタは当該画面で使う列だけ。別画面の設定を迂回して全件の個人情報を読ませない。
export const GET = async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const page = params.get("page") ?? "", dataset = params.get("dataset") ?? "";
  const datasets: Record<string, Record<string, [string, string]>> = {
    "root-companies": { companies: ["root_companies", "*"] },
    "root-bank-accounts": { "bank-accounts": ["root_bank_accounts", "*"], corporations: ["bud_corporations", "id,name_short"] },
    "root-vendors": { vendors: ["root_vendors", "*"], companies: ["root_companies", "company_id,company_name"] },
    "root-salary-systems": { "salary-systems": ["root_salary_systems", "*"] },
    "root-insurance": { insurance: ["root_insurance", "*"] },
    "root-employees": { employees: ["root_employees", ROOT_EMPLOYEE_SELECT_FIELDS], companies: ["root_companies", "company_id,company_name"], "salary-systems": ["root_salary_systems", "salary_system_id,system_name"] },
    "root-attendance": { attendance: ["root_attendance", "*"], employees: ["root_employees", "employee_id,employee_number,name"] },
    "root-permissions": { employees: ["root_employees", "employee_id,employee_number,name,employment_type,garden_role,is_active"] },
    "root-kot-sync-history": { "sync-logs": ["root_kot_sync_log", "*"] },
  };
  // Object prototype の key も含め、登録されていない組み合わせは拒否する。
  const config = Object.hasOwn(datasets, page) && Object.hasOwn(datasets[page], dataset) ? datasets[page][dataset] : undefined;
  if (!config) return Response.json({ error: "対象を確認してください。" }, { status: 403, headers });
  const denied = await systemViewResponse(page);
  if (denied) return denied;
  const [table, select] = config;
  let query = getSupabaseAdmin().from(table).select(select);
  switch (dataset) {
    case "companies": query = query.order(page === "root-companies" ? "established_on" : "company_id", { ascending: true, nullsFirst: false }); break;
    case "bank-accounts": query = query.is("deleted_at", null).order("corp_code").order("bank_code").order("account_number"); break;
    case "corporations": query = query.order("established_on", { ascending: true, nullsFirst: false }); break;
    case "vendors": query = query.order("vendor_name_kana"); break;
    case "salary-systems": query = query.order("salary_system_id"); break;
    case "insurance": query = query.order("fiscal_year", { ascending: false }); break;
    case "employees":
      if (page === "root-employees") query = query.order("company_id");
      query = query.order("employee_number");
      break;
    case "attendance":
      query = query.order("target_month", { ascending: false }).order("employee_id");
      if (params.get("month")) query = query.eq("target_month", params.get("month")!);
      break;
    case "sync-logs": {
      const limit = Math.max(1, Math.min(Number(params.get("limit")) || 50, 200));
      const offset = Math.max(0, Number(params.get("offset")) || 0);
      query = query.order("triggered_at", { ascending: false }).range(offset, offset + limit - 1);
      if (params.get("id")) query = query.eq("id", params.get("id")!);
      for (const key of ["sync_type", "status"]) if (params.get(key)) query = query.eq(key, params.get(key)!);
      if (params.get("from")) query = query.gte("triggered_at", `${params.get("from")}T00:00:00+09:00`);
      if (params.get("to")) query = query.lt("triggered_at", `${params.get("to")}T24:00:00+09:00`);
    }
  }
  const { data, error } = await query;
  if (error) return Response.json({ error: "読み込めませんでした。" }, { status: 500, headers });
  return Response.json({ data: data ?? [] }, { headers });
};
