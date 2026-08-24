import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import {
  buildCompanyToCorp,
  FALLBACK_CORPS,
  getEffectiveCorpId,
  type Company,
  type Corp,
  type Employee,
} from "@/app/bud/expenses/_components/expenseCorpUtils";
import { writeFileMakerLedgerBuffer, type FileMakerLedgerSource } from "@/app/bud/expenses/_lib/filemaker-ledger-export";
import { resolveExpenseApplicantName } from "@/app/bud/expenses/_lib/expense-employees";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type ExportBody = { corpId?: string; scope?: "pending" | "done"; start?: string | null; end?: string | null };
type RequestRow = {
  id: string;
  corp_id: string | null;
  applicant_employee_id: string | null;
  applicant_name_text: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_class: string | null;
  qualified_number: string | null;
  category_id: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  keiri_checked_at: string | null;
  keiri_checked_by: string | null;
  booking_date: string | null;
  booking_corp_id: string | null;
  fiscal_period: string | null;
};
type Category = { id: string; name: string };
type Corporation = Corp & { established_on: string | null; fiscal_end_month: number | null };
type NamedUser = { user_id: string | null; name: string | null };

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,applicant_name_text,receipt_date,store_name,amount,qualified_class,qualified_number,category_id,submitted_at,submitted_by,keiri_checked_at,keiri_checked_by,booking_date,booking_corp_id,fiscal_period";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });

    const { data: hasAccess, error: accessError } = await supabase.rpc("bud_has_access");
    if (accessError || !hasAccess) return NextResponse.json({ ok: false, error: "Bud権限がありません" }, { status: 403 });

    const body = (await request.json()) as ExportBody;
    const corpId = body.corpId ?? "all";
    const scope = body.scope === "done" ? "done" : "pending";
    let expenseQuery = supabase
      .from("bud_expense_requests")
      .select(REQUEST_SELECT)
      .eq("status", scope === "done" ? "journalized" : "journalize_pending")
      .is("deleted_at", null);
    if (scope === "done" && body.start) expenseQuery = expenseQuery.gte("booking_date", body.start);
    if (scope === "done" && body.end) expenseQuery = expenseQuery.lt("booking_date", body.end);
    expenseQuery = expenseQuery.order(scope === "done" ? "booking_date" : "receipt_date", { ascending: scope !== "done", nullsFirst: false });
    const [requestRes, categoryRes, corporationRes, companyRes] = await Promise.all([
      expenseQuery.order("submitted_at", { ascending: true }),
      supabase.from("bud_expense_categories").select("id,name"),
      supabase.from("bud_corporations").select("id,name_short,established_on,fiscal_end_month"),
      supabase.from("root_companies").select("company_id,company_name"),
    ]);
    if (requestRes.error) throw new Error(`対象取得に失敗しました: ${requestRes.error.message}`);
    if (categoryRes.error) throw new Error(`区分取得に失敗しました: ${categoryRes.error.message}`);
    if (corporationRes.error) throw new Error(`法人取得に失敗しました: ${corporationRes.error.message}`);

    const requests = (requestRes.data as RequestRow[] | null) ?? [];
    const corporations = (corporationRes.data as Corporation[] | null) ?? [];
    const corpList: Corp[] = corporations.length > 0 ? corporations : FALLBACK_CORPS;
    const companyToCorp = buildCompanyToCorp((companyRes.data as Company[] | null) ?? [], corpList);
    const employeeIds = unique(requests.map((row) => row.applicant_employee_id));
    const userIds = unique(requests.flatMap((row) => [row.submitted_by, row.keiri_checked_by]));
    const admin = getSupabaseAdmin();
    const [employeeRes, userRes] = await Promise.all([
      employeeIds.length
        ? admin.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("root_employees").select("user_id,name").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (employeeRes.error || userRes.error) throw new Error("従業員名の取得に失敗しました");

    const employees = Object.fromEntries(
      (((employeeRes.data as Employee[] | null) ?? [])).map((employee) => [employee.employee_id, employee]),
    );
    const userNames = new Map(
      (((userRes.data as NamedUser[] | null) ?? [])).filter((row) => row.user_id).map((row) => [row.user_id as string, row.name ?? ""]),
    );
    const categories = new Map((((categoryRes.data as Category[] | null) ?? [])).map((row) => [row.id, row.name]));
    const corpMap = new Map(corporations.map((corp) => [corp.id, corp]));

    const filtered = requests.filter((row) => {
      if (corpId === "all") return true;
      return scope === "done" ? row.booking_corp_id === corpId : getEffectiveCorpId(row, employees, companyToCorp) === corpId;
    });
    const ledgerRows: FileMakerLedgerSource[] = filtered.map((row) => {
      const effectiveCorpId = getEffectiveCorpId(row, employees, companyToCorp);
      const corp = effectiveCorpId ? corpMap.get(effectiveCorpId) : undefined;
      const bookingCorp = row.booking_corp_id ? corpMap.get(row.booking_corp_id) : undefined;
      return {
        corpName: corp?.name_short ?? effectiveCorpId ?? "",
        applicantName: resolveExpenseApplicantName(row, employees),
        qualifiedClass: row.qualified_class,
        qualifiedNumber: row.qualified_number,
        categoryName: row.category_id ? categories.get(row.category_id) ?? row.category_id : "",
        receiptDate: row.receipt_date,
        storeName: row.store_name,
        amount: row.amount,
        submittedAt: row.submitted_at,
        submittedByName: row.submitted_by ? userNames.get(row.submitted_by) ?? "" : "",
        keiriCheckedAt: row.keiri_checked_at,
        keiriCheckedByName: row.keiri_checked_by ? userNames.get(row.keiri_checked_by) ?? "" : "",
        bookingDate: row.booking_date,
        bookingCorpName: bookingCorp?.name_short ?? null,
        fiscalPeriod: row.fiscal_period,
      };
    });

    const buffer = await writeFileMakerLedgerBuffer(ledgerRows);
    const filename = `領収書-Garden経費-${formatJstYmd(new Date())}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Bud-Expense-Ledger-Rows": String(ledgerRows.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "台帳形式の書き出しに失敗しました" },
      { status: 500 },
    );
  }
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function formatJstYmd(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}${read("month")}${read("day")}`;
}
