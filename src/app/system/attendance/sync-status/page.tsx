import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { MANAGER_ROLES } from "../../_lib/attendance";
import SyncStatusClient from "./SyncStatusClient";
import ShachoShell from "../../_components/ShachoShell/ShachoShell";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";

export const metadata = { title: "勤怠 KOT同期状況 | Garden" };

export default async function SyncStatusPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=%2Fsystem%2Fattendance%2Fsync-status");
  const { data: employee } = await supabase.from("root_employees").select("name,garden_role,company_id")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (!employee || !MANAGER_ROLES.has(String(employee.garden_role))) return <main style={{padding:32}}><h1>閲覧権限がありません</h1><p>この画面は責任者以上が利用できます。</p></main>;
  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole) ? employee.garden_role as GardenRole : "staff";
  const company = employee.company_id ? (await supabase.from("root_companies").select("company_name").eq("company_id", employee.company_id).maybeSingle()).data : null;
  return <ShachoShell activePath="/system/attendance" user={{name:String(employee.name),company:String(company?.company_name??"所属会社未登録"),role}}><SyncStatusClient/></ShachoShell>;
}

