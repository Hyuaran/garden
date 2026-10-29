import { NextResponse } from "next/server";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { effectiveConfirmations, needsQuarterlyConfirmation } from "@/app/system/mypage/_lib/quarterly-confirm";
export async function GET() {
 const employee = await requireEmployee();
 if (!employee) return NextResponse.json({ok:false},{status:401});
 const admin = getSupabaseAdmin();
 const [history,person,submissions] = await Promise.all([
 admin.from("root_employee_profile_history").select("category,source,recorded_at,confirmed_by_employee_at").eq("employee_id",employee.employee_id),
 admin.from("root_employees").select("hire_date,birthday").eq("employee_id",employee.employee_id).single(),
 admin.from("system_mypage_submissions").select("submission_type,created_at").eq("employee_id",employee.employee_id).in("submission_type",["emergency_contact","bank_account","commute_route","dependents"])
 ]);
 if (history.error || person.error || submissions.error) return NextResponse.json({ok:false},{status:500});
 const confirmations = effectiveConfirmations(history.data as Parameters<typeof effectiveConfirmations>[0],person.data.hire_date);
 for (const row of submissions.data ?? []) for (const category of row.submission_type === "emergency_contact" ? ["address","contact","emergency_contact"] : row.submission_type === "bank_account" ? ["bank_account"] : row.submission_type === "dependents" ? ["dependents"] : ["commute"]) {
 if (!confirmations[category] || Date.parse(row.created_at) > Date.parse(confirmations[category])) confirmations[category]=row.created_at;
 }
 return NextResponse.json({ok:true,required:needsQuarterlyConfirmation(confirmations),confirmations,birthdayRegistered:Boolean(person.data.birthday)}, {headers:{"Cache-Control":"no-store"}});
}
