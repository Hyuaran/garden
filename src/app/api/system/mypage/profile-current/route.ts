import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { buildMyPageProfile } from "@/app/system/mypage/_lib/mypage-profile.server";

export async function GET() {
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("employee_id,name,name_kana,employee_number,employment_type,birthday,email,garden_role,commute_daily_allowance,commute_monthly_cap")
    .eq("employee_id", employee.employee_id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false }, { status: error ? 500 : 404 });
  return NextResponse.json({ ok: true, profile: await buildMyPageProfile(data) });
}
