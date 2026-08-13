import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import AttendanceClient from "./AttendanceClient";

export const metadata = { title: "勤怠打刻 | Garden" };

export default async function AttendancePage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fattendance");
  const { data: employee } = await supabase.from("root_employees").select("name,garden_role")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  return <AttendanceClient registered={Boolean(employee)} employeeName={employee?.name ? String(employee.name) : null}
    canViewSync={employee ? ["manager", "admin", "super_admin"].includes(String(employee.garden_role)) : false} />;
}

