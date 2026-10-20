import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function mfAccess() {
  const db = await createServerClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return { ok: false as const, status: 401 };
  const access = await db.rpc("bud_has_access");
  if (access.error || !access.data) return { ok: false as const, status: 403 };
  const employee = await getSupabaseAdmin().from("root_employees").select("employee_id,garden_role").eq("user_id", auth.data.user.id).is("deleted_at", null).maybeSingle();
  if (employee.error || !employee.data) return { ok: false as const, status: 403 };
  return { ok: true as const, db, admin: employee.data.garden_role === "super_admin", employeeId: employee.data.employee_id as string };
}
