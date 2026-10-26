import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { NextResponse } from "next/server";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchKotEmployees, KotApiClientError } from "@/app/root/_lib/kot-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from("root_employees")
    .select("garden_role").eq("employee_id", employee.employee_id).maybeSingle();
  if (error || data?.garden_role !== "super_admin") return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const employees = await fetchKotEmployees({ date });
    return NextResponse.json({ count: employees.length, firstEmployeeCode: employees[0]?.code ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof KotApiClientError ? error.code : "UNKNOWN" }, { status: 502 });
  }
}
