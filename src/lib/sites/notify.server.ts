import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { eligibleEmployee, type NotifyEmployee, type NotifyState } from "./notify";
export async function loadNotifyState(): Promise<NotifyState> {
 const admin=getSupabaseAdmin();
 const [employees,recipients]=await Promise.all([
 admin.from("root_employees").select("employee_id,name,chatwork_account_id,is_active,termination_date,deleted_at").eq("is_active",true).is("deleted_at",null).order("name"),
 admin.from("system_site_notify_recipients").select("site_key,employee_id").order("registration_order")]);
 if(employees.error || recipients.error) throw new Error("通知先を読み込めませんでした。");
 const result: NotifyState={employees:(employees.data as NotifyEmployee[]).filter(eligibleEmployee).map(e=>({value:e.employee_id,label:e.name})),recipients:{}};
 for(const row of recipients.data ?? []) (result.recipients[row.site_key] ??= []).push(row.employee_id);
 return result;
}
