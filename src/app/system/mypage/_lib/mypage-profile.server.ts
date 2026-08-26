import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MyPageProfile } from "../types";

export async function buildMyPageProfile(row:Record<string,unknown>):Promise<MyPageProfile>{
  const employeeId=String(row.employee_id??"");
  const admin=getSupabaseAdmin();
  const [bankResult,mynaResult]=employeeId?await Promise.all([
    admin.from("bud_employee_bank_accounts").select("bank_name,branch_name").eq("employee_id",employeeId).eq("is_active",true).order("effective_from",{ascending:false}).limit(1).maybeSingle(),
    admin.from("root_employee_my_numbers").select("employee_id").eq("employee_id",employeeId).maybeSingle(),
  ]):[{data:null},{data:null}];
  const bank=bankResult.data as {bank_name?:unknown;branch_name?:unknown}|null;
  return {name:String(row.name??"-"),nameKana:String(row.name_kana??"-"),employeeNumber:String(row.employee_number??"-"),employmentType:String(row.employment_type??"-"),birthday:typeof row.birthday==="string"?row.birthday:null,email:String(row.email??"-"),gardenRole:String(row.garden_role??"-"),bankName:typeof bank?.bank_name==="string"?bank.bank_name:null,branchName:typeof bank?.branch_name==="string"?bank.branch_name:null,commuteDailyAllowance:typeof row.commute_daily_allowance==="number"?row.commute_daily_allowance:null,commuteMonthlyCap:typeof row.commute_monthly_cap==="number"?row.commute_monthly_cap:null,mynaSubmitted:Boolean(mynaResult.data)};
}
