import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentProfile, getLatestConfirmations } from "@/app/root/_lib/profile-history.server";
import type { MyPageProfile } from "../types";

export async function buildMyPageProfile(row:Record<string,unknown>):Promise<MyPageProfile>{
  const employeeId=String(row.employee_id??"");
  const admin=getSupabaseAdmin();
  const pendingQuery = employeeId ? admin.from("system_mypage_submissions").select("submission_type,created_at").eq("employee_id",employeeId) as unknown as { in?: (...args: unknown[]) => { order: (...args: unknown[]) => { limit: (count:number) => Promise<{data?: unknown[]}> } } } : null;
  const pendingRowsPromise: Promise<{data?: unknown[]}> = pendingQuery && typeof pendingQuery.in === "function"
    ? pendingQuery.in("status",["received","in_progress","amount_proposing","awaiting_employee"]).order("created_at",{ascending:false}).limit(30)
    : Promise.resolve({ data: [] });
  const [bankResult,mynaResult,current,confirmations,pendingResult]=employeeId?await Promise.all([
    admin.from("bud_employee_bank_accounts").select("bank_name,branch_name").eq("employee_id",employeeId).eq("is_active",true).order("effective_from",{ascending:false}).limit(1).maybeSingle(),
    admin.from("root_employee_my_numbers").select("employee_id").eq("employee_id",employeeId).maybeSingle(),
    getCurrentProfile(admin, employeeId, false),
    getLatestConfirmations(admin, employeeId),
    pendingRowsPromise,
  ]):[{data:null},{data:null},{},{},{data:[]}];
  const bank=bankResult.data as {bank_name?:unknown;branch_name?:unknown}|null;
  const currentProfile=Object.fromEntries(Object.entries(current).map(([category,item])=>[category,{id:item.id,payload:item.payload,source:item.source,sourceRef:item.source_ref,sourceDocumentUrl:item.source_document_url,effectiveFrom:item.effective_from,recordedAt:item.recorded_at}]));
  const pendingSubmissions=(Array.isArray(pendingResult.data)?pendingResult.data:[]).map((item)=>{const row=item as Record<string,unknown>;return {type:String(row.submission_type),createdAt:String(row.created_at)};});
  return {name:String(row.name??"-"),nameKana:String(row.name_kana??"-"),employeeNumber:String(row.employee_number??"-"),employmentType:String(row.employment_type??"-"),birthday:typeof row.birthday==="string"?row.birthday:null,email:String(row.email??"-"),gardenRole:String(row.garden_role??"-"),bankName:typeof bank?.bank_name==="string"?bank.bank_name:null,branchName:typeof bank?.branch_name==="string"?bank.branch_name:null,commuteDailyAllowance:typeof row.commute_daily_allowance==="number"?row.commute_daily_allowance:null,commuteMonthlyCap:typeof row.commute_monthly_cap==="number"?row.commute_monthly_cap:null,mynaSubmitted:Boolean(mynaResult.data),current:currentProfile,confirmations,pendingSubmissions};
}
