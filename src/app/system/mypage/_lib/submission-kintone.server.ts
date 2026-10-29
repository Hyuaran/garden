import { queueRosterPush } from '@/app/root/_lib/roster-push.server';
import type {SubmissionRow} from "./submission-types";
type Employee={name:string;kot_employee_id:string|null;commute_monthly_cap:number|null};
type SyncResult={status:"synced"|"skipped"|"failed";note:string|null};
const v=(value:unknown)=>({value:value==null?"":String(value)});

async function call(path:string,method:"POST"|"PUT",token:string,body:unknown,overrideGet=false):Promise<Record<string,unknown>>{
  const sub=process.env.KINTONE_SUBDOMAIN;if(!sub||!token)throw new Error("not_configured");
  const headers:Record<string,string>={"content-type":"application/json","X-Cybozu-API-Token":token};
  if(overrideGet)headers["X-HTTP-Method-Override"]="GET";
  const response=await fetch(`https://${sub}.cybozu.com${path}`,{method,headers,body:JSON.stringify(body)});
  if(!response.ok){const text=await response.text().catch(()=>"");throw new Error(`kintone_${response.status}:${text.slice(0,200)}`)}
  return response.json() as Promise<Record<string,unknown>>;
}

export async function syncSubmissionToKintone(row:SubmissionRow,employee:Employee):Promise<SyncResult>{
  if(!["commute_route","bank_account"].includes(row.submission_type))return{status:"skipped",note:"Kintone反映対象外"};
  const push=await queueRosterPush(row.employee_id,'inbox');
  if(!employee.kot_employee_id)return{status:"skipped",note:"KING OF TIME の ID未登録のため名簿更新をスキップ"};
  const targetToken=row.submission_type==="commute_route"?process.env.KINTONE_COMMUTE_TOKEN:process.env.KINTONE_PAYROLL_ACCOUNT_TOKEN;
  if(!process.env.KINTONE_SUBDOMAIN||!targetToken)return{status:"skipped",note:"Kintone環境変数未設定"};
  try{
    const kot=employee.kot_employee_id,p=row.payload,rosterToken=process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN||"";
    if(row.submission_type==="commute_route"){
      await call("/k/v1/record.json","POST",`${process.env.KINTONE_COMMUTE_TOKEN||""},${rosterToken}`,{app:process.env.KINTONE_COMMUTE_APP_ID||"93",record:{ルックアップ:v(kot),文字列__1行_:v(employee.name),数値:v(row.proposed_one_way),数値_0:v(employee.commute_monthly_cap),文字列__1行__1:v(p.station)}});
    }else{
      await call("/k/v1/record.json","POST",`${process.env.KINTONE_PAYROLL_ACCOUNT_TOKEN||""},${rosterToken}`,{app:process.env.KINTONE_PAYROLL_ACCOUNT_APP_ID||"92",record:{支払先:v(employee.name),文字列__1行__0:v(employee.name),ルックアップ_0:v(kot),銀行名:v(p.bankName),文字列__1行_:v(p.bankCode),支店名:v(p.branchName),支店コード:v(p.branchCode),種別:v("普通"),口座番号:v(p.accountNumber),口座名義カナ:v(p.holderKana),支払用途:v("給料賃金"),稼働状況:v("○")}});
    }
    return{status:push.warning?'failed':'synced',note:push.warning??null};
  }catch(error){const detail=error instanceof Error?error.message:String(error);return{status:"failed",note:`Kintone反映失敗: ${detail.slice(0,200)}`};}
}
