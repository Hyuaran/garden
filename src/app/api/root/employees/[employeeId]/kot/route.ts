import { NextResponse } from "next/server";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchKotEmployeeByCode, fetchKotHireOptions, updateKotEmployee, isKotUpdateDate } from "@/app/root/_lib/kot-api";

export const runtime = "nodejs";
type Context = { params: Promise<{ employeeId: string }> };
async function authorize() {
  const actor = await requireEmployee();
  if (!actor) return null;
  const { data, error } = await getSupabaseAdmin().from("root_employees").select("garden_role").eq("employee_id", actor.employee_id).maybeSingle();
  return !error && data?.garden_role === "super_admin" ? actor : null;
}
async function employee(employeeId: string) {
  const { data, error } = await getSupabaseAdmin().from("root_employees").select("kot_employee_id").eq("employee_id", employeeId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("従業員の情報を読み込めませんでした");
  if (!data || !/^\d+$/.test(data.kot_employee_id ?? "")) throw new Error("KOT の従業員コードを確認してください");
  return fetchKotEmployeeByCode(data.kot_employee_id);
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "KOT の操作に失敗しました" }, { status: 400 });
}
export async function GET(_request: Request, context: Context) {
  if (!await authorize()) return NextResponse.json({ error: "全権管理者のみ操作できます" }, { status: 403 });
  try {
    const current = await employee((await context.params).employeeId);
    const options = await fetchKotHireOptions();
    return NextResponse.json({ code: current.code, divisionCode: current.divisionCode ?? "", typeCode: current.typeCode ?? "", ...options });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: Context) {
  const actor = await authorize();
  if (!actor) return NextResponse.json({ error: "全権管理者のみ操作できます" }, { status: 403 });
  try {
    if (process.env.KOT_EMPLOYEE_UPDATE_ENABLED !== "true") throw new Error("KOT の変更は止めています");
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["divisionCode", "typeCode", "updateDate"].includes(key)) || !isKotUpdateDate(body.updateDate)) throw new Error("変更内容と日付を確認してください");
    const fields: { divisionCode?: string; typeCode?: string } = {};
    for (const key of ["divisionCode", "typeCode"] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "string" || !/^[a-zA-Z0-9-]+$/.test(body[key])) throw new Error("所属・雇用区分を選んでください");
        fields[key] = body[key];
      }
    }
    if (!Object.keys(fields).length) throw new Error("変更する項目を選んでください");
    const { employeeId } = await context.params;
    const before = await employee(employeeId);
    const options = await fetchKotHireOptions();
    if (fields.divisionCode && !options.divisions.some(o => o.code === fields.divisionCode) || fields.typeCode && !options.workingTypes.some(o => o.code === fields.typeCode)) throw new Error("所属・雇用区分を読み直してください");
    await updateKotEmployee(before.key, fields, body.updateDate);
    let auditFailed = false;
    try {
    const { error } = await getSupabaseAdmin().from("root_audit_log").insert({
      actor_user_id: actor.userId, actor_emp_num: actor.employee_number, action: "kot_employee_update", target_type: "root_employees", target_id: employeeId,
      payload: { updateDate: body.updateDate, before: { divisionCode: before.divisionCode ?? null, typeCode: before.typeCode ?? null }, after: { divisionCode: fields.divisionCode ?? before.divisionCode ?? null, typeCode: fields.typeCode ?? before.typeCode ?? null } },
    });
    auditFailed = Boolean(error);
    } catch { auditFailed = true; }
    if (auditFailed) return NextResponse.json({ error: "KOT に反映しましたが、変更の記録を保存できませんでした。再反映せず管理者にお知らせください" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}