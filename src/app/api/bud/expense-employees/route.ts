import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  employee_id: string;
  company_id: string | null;
  name: string | null;
  user_id?: string | null;
  expense_default_corp_id?: string | null;
};

const MAX_IDS = 2000;

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: hasAccess, error: accessError } = await supabase.rpc("bud_has_access");
  if (accessError || !hasAccess) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let employeeIds: string[] = [];
  let userIds: string[] = [];
  try {
    const body = (await request.json()) as { employeeIds?: unknown; userIds?: unknown };
    if (Array.isArray(body.employeeIds)) {
      employeeIds = body.employeeIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
    if (Array.isArray(body.userIds)) {
      userIds = body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  employeeIds = Array.from(new Set(employeeIds)).slice(0, MAX_IDS);
  userIds = Array.from(new Set(userIds)).slice(0, MAX_IDS);
  if (employeeIds.length === 0 && userIds.length === 0) {
    return NextResponse.json({ ok: true, employees: [], userEmployees: [] });
  }

  const admin = getSupabaseAdmin();
  let employees: EmployeeRow[] = [];
  let employeeError: string | null = null;

  if (employeeIds.length > 0) {
    const withDefault = await admin
      .from("root_employees")
      .select("employee_id,company_id,name,expense_default_corp_id")
      .in("employee_id", employeeIds);

    if (!withDefault.error) {
      employees = (withDefault.data as EmployeeRow[] | null) ?? [];
    } else {
      const fallback = await admin.from("root_employees").select("employee_id,company_id,name").in("employee_id", employeeIds);
      if (fallback.error) employeeError = fallback.error.message;
      else employees = (fallback.data as EmployeeRow[] | null) ?? [];
    }
  }

  let userEmployees: EmployeeRow[] = [];
  if (userIds.length > 0) {
    const byUser = await admin.from("root_employees").select("employee_id,company_id,name,user_id").in("user_id", userIds);
    if (byUser.error) {
      return NextResponse.json({ ok: false, error: byUser.error.message }, { status: 500 });
    }
    userEmployees = (byUser.data as EmployeeRow[] | null) ?? [];
  }

  if (employeeError) {
    return NextResponse.json({ ok: false, error: employeeError }, { status: 500 });
  }

  return NextResponse.json({ ok: true, employees, userEmployees });
}
