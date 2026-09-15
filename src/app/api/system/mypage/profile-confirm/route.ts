import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { PROFILE_CATEGORIES, getCurrentProfile, insertProfileHistoryIfChanged, todayJst, type ProfileCategory } from "@/app/root/_lib/profile-history.server";

export async function POST(request: Request) {
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { category?: unknown } | null;
  const category = typeof body?.category === "string" ? body.category : "";
  if (!PROFILE_CATEGORIES.includes(category as ProfileCategory)) {
    return NextResponse.json({ ok: false, error: "区分を確認してください。" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const current = await getCurrentProfile(admin, employee.employee_id, true);
  const row = current[category];
  if (!row) return NextResponse.json({ ok: false, error: "登録内容がありません。" }, { status: 409 });
  const confirmedAt = new Date().toISOString();
  await insertProfileHistoryIfChanged(admin, {
    employee_id: employee.employee_id,
    category,
    payload: row.payload,
    source: "employee_confirm",
    source_ref: row.id ?? null,
    source_document_url: row.source_document_url ?? null,
    effective_from: todayJst(),
    recorded_by: String(employee.employee_number ?? employee.employee_id),
    confirmed_by_employee_at: confirmedAt,
    note: "本人がマイページで確認",
  });
  return NextResponse.json({ ok: true, confirmedAt });
}
