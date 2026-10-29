import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { type SubmissionType } from "@/app/system/mypage/_lib/submission-types";
import { createSubmission } from "@/app/system/mypage/_lib/create-submission.server";

export async function GET() {
  const employee = await requireViewEmployee("system-mypage", "", "employee");
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_mypage_submissions")
    .select("id,submission_type,payload,status,proposed_one_way,created_at")
    .eq("employee_id", employee.employee_id)
    .order("created_at", { ascending: false })
    .limit(30);
  return error
    ? NextResponse.json({ ok: false }, { status: 500 })
    : NextResponse.json({ ok: true, rows: data });
}

export async function POST(request: Request) {
  for (const scopeTab of [""]) {
    const viewDenied = await systemViewResponse("system-mypage", scopeTab, true);
    if (viewDenied) return viewDenied;
  }

  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { type?: SubmissionType; payload?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "入力内容を確認してください。" },
      { status: 400 },
    );
  }
  return createSubmission({ employee_id: employee.employee_id, name: String(employee.name), employee_number: String(employee.employee_number), company_id: employee.company_id }, body);
}
