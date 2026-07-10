import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  employee_id: string;
  company_id: string | null;
  name: string | null;
  expense_default_corp_id?: string | null;
};

const MAX_IDS = 2000;

/**
 * 経費レビュー画面用に、申請者の社員名を引く。
 *
 * root_employees は RLS で本人の行しか読めないため、staff の経理担当が他人の申請を
 * 見ると名前が引けず社員番号のまま表示されてしまう。ここで Bud アクセス権を確認した上で
 * service role で必要な社員だけを返す（bud_corporations と同じ方式）。
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Bud の利用権限（garden_role 自動許可 or bud_users 明示登録）を持つ人だけに開示する
  const { data: hasAccess, error: accessError } = await supabase.rpc("bud_has_access");
  if (accessError || !hasAccess) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let employeeIds: string[] = [];
  try {
    const body = (await request.json()) as { employeeIds?: unknown };
    if (Array.isArray(body.employeeIds)) {
      employeeIds = body.employeeIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  employeeIds = Array.from(new Set(employeeIds)).slice(0, MAX_IDS);
  if (employeeIds.length === 0) {
    return NextResponse.json({ ok: true, employees: [] });
  }

  const admin = getSupabaseAdmin();
  const withDefault = await admin
    .from("root_employees")
    .select("employee_id,company_id,name,expense_default_corp_id")
    .in("employee_id", employeeIds);

  if (!withDefault.error) {
    return NextResponse.json({ ok: true, employees: (withDefault.data as EmployeeRow[] | null) ?? [] });
  }

  // expense_default_corp_id 列が無い環境向けのフォールバック
  const fallback = await admin.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
  if (fallback.error) {
    return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, employees: (fallback.data as EmployeeRow[] | null) ?? [] });
}
