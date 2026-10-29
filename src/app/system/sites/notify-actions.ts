"use server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { loadNotifyState } from "@/lib/sites/notify.server";
import sites from "./_data/corporate-sites.json";
export async function saveNotifyRecipients(siteKey:string,ids:string[]){
 const client=await createServerClient(); const {data:auth}=await client.auth.getUser();
 if(!auth.user) throw new Error("変更する権限がありません。");
 const {data:employee}=await client.from("root_employees").select("employee_id,garden_role,is_active,termination_date,deleted_at").eq("user_id",auth.user.id).eq("is_active",true).is("deleted_at",null).maybeSingle();
 if(!employee || !isEmployeeActive(employee) || employee.garden_role!=="super_admin") throw new Error("変更する権限がありません。");
 const {viewer}=await viewPermissionContext();
 if(!await canView("system-sites","sites",viewer)) throw new Error("変更する権限がありません。");
 if(!sites.sites.some(s=>s.notify_key===siteKey) || !Array.isArray(ids) || ids.some(id=>typeof id!=="string") || new Set(ids).size!==ids.length) throw new Error("変更する権限がありません。");
 const state=await loadNotifyState();
 if(ids.some(id=>!state.employees.some(e=>e.value===id))) throw new Error("Root で Chatwork の番号を登録してください。");
 const {error}=await getSupabaseAdmin().rpc("replace_site_notify_recipients",{p_site_key:siteKey,p_employee_ids:ids,p_updated_by:employee.employee_id});
 if(error) throw new Error("通知先を登録できませんでした。");
}
