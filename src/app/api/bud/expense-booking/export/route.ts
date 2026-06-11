import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { exportYayoiCsv } from "@/shared/_lib/bank-csv-parsers/yayoi-csv-exporter";
import { classifyExpenseJournal, toYayoiRows } from "@/app/bud/expenses/_lib/expense-journal-rules";
import {
  buildCompanyToCorp,
  FALLBACK_CORPS,
  getEffectiveCorpId,
  type Company,
  type Corp,
  type Employee,
} from "@/app/bud/expenses/_components/expenseCorpUtils";

export const runtime = "nodejs";
export const maxDuration = 60;

type ExportBody = {
  corpId?: string;
  ids?: string[];
};

type Req = {
  id: string;
  corp_id: string | null;
  applicant_employee_id: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_class: string | null;
  category_id: string | null;
  status: string;
  submitted_at: string;
};

type Cat = {
  id: string;
  name: string;
};

const REQUEST_SELECT =
  "id,corp_id,applicant_employee_id,receipt_date,store_name,amount,qualified_class,category_id,status,submitted_at";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }

    const { data: hasAccess, error: accessError } = await supabase.rpc("bud_has_access");
    if (accessError) {
      return NextResponse.json({ ok: false, error: `権限確認に失敗しました: ${accessError.message}` }, { status: 500 });
    }
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "Bud権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as ExportBody;
    const corpId = body.corpId;
    const ids = Array.from(new Set(body.ids ?? []));
    if (!corpId || corpId === "all") {
      return NextResponse.json({ ok: false, error: "法人を1つ選択してください" }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "書き出す行が選択されていません" }, { status: 400 });
    }

    const [reqRes, catRes, corpRes, companyRes] = await Promise.all([
      supabase
        .from("bud_expense_requests")
        .select(REQUEST_SELECT)
        .in("id", ids)
        .eq("status", "journalize_pending")
        .order("receipt_date", { ascending: true, nullsFirst: false })
        .order("submitted_at", { ascending: true }),
      supabase.from("bud_expense_categories").select("id,name").eq("is_active", true),
      supabase.from("bud_corporations").select("id,name_short"),
      supabase.from("root_companies").select("company_id,company_name"),
    ]);

    if (reqRes.error) {
      return NextResponse.json({ ok: false, error: `対象取得に失敗しました: ${reqRes.error.message}` }, { status: 500 });
    }

    const rows = (reqRes.data as Req[] | null) ?? [];
    if (rows.length !== ids.length) {
      return NextResponse.json({ ok: false, error: "対象外または更新済みの行が含まれています" }, { status: 409 });
    }

    const categoryMap = new Map(((catRes.data as Cat[] | null) ?? []).map((cat) => [cat.id, cat.name]));
    const corpList = (corpRes.data as Corp[] | null) ?? FALLBACK_CORPS;
    const companyToCorp = buildCompanyToCorp((companyRes.data as Company[] | null) ?? [], corpList);

    const employeeIds = Array.from(new Set(rows.map((row) => row.applicant_employee_id).filter((id): id is string => Boolean(id))));
    const employees: Record<string, Employee> = {};
    if (employeeIds.length > 0) {
      const { data } = await supabase.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
      for (const employee of ((data as Employee[] | null) ?? [])) {
        employees[employee.employee_id] = employee;
      }
    }

    const wrongCorp = rows.find((row) => getEffectiveCorpId(row, employees, companyToCorp) !== corpId);
    if (wrongCorp) {
      return NextResponse.json({ ok: false, error: "選択法人以外の行が含まれています" }, { status: 400 });
    }

    const results = rows.map((row) => {
      const applicantName = row.applicant_employee_id ? employees[row.applicant_employee_id]?.name ?? row.applicant_employee_id : "未設定";
      return classifyExpenseJournal({
        id: row.id,
        receiptDate: row.receipt_date,
        categoryName: row.category_id ? categoryMap.get(row.category_id) ?? row.category_id : null,
        storeName: row.store_name,
        amount: row.amount,
        qualifiedClass: row.qualified_class,
        applicantName,
      });
    });
    const invalid = results.find((result) => !result.ok);
    if (invalid) {
      return NextResponse.json({ ok: false, error: `要確認行は書き出せません: ${invalid.note}` }, { status: 400 });
    }

    const yayoiRows = toYayoiRows(results);
    const csvBuffer = exportYayoiCsv(yayoiRows);
    const nowIso = new Date().toISOString();
    const updateRes = await supabase
      .from("bud_expense_requests")
      .update({ status: "journalized", journalized_by: auth.user.id, journalized_at: nowIso })
      .in("id", ids)
      .eq("status", "journalize_pending")
      .select("id");

    if (updateRes.error) {
      return NextResponse.json({ ok: false, error: `仕訳済み更新に失敗しました: ${updateRes.error.message}` }, { status: 500 });
    }
    if (((updateRes.data as Array<{ id: string }> | null) ?? []).length !== ids.length) {
      return NextResponse.json({ ok: false, error: "一部の行を仕訳済みに更新できませんでした" }, { status: 409 });
    }

    const corpName = corpList.find((corp) => corp.id === corpId)?.name_short ?? corpId;
    const today = formatYmd(new Date());
    const filename = `弥生インポート_経費_${corpName}_${today}.csv`;
    return new NextResponse(new Uint8Array(csvBuffer), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=Shift_JIS",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Bud-Expense-Booking-Rows": String(yayoiRows.length),
        "X-Bud-Expense-Booking-Corp": corpId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "CSV書き出しに失敗しました" },
      { status: 500 },
    );
  }
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
