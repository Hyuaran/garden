import { getRosterDirection, queueRosterPush } from '@/app/root/_lib/roster-push.server';
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

const escapeQueryValue=(value:string)=>value.replace(/\\/g,"\\\\").replace(/"/g,'\\"');
async function findRosterId(token:string,app:string,kotId:string):Promise<string|null>{
  const result=await call("/k/v1/records.json","POST",token,{app,query:`打刻ID = "${escapeQueryValue(kotId)}" order by 作成日時 desc limit 1`,fields:["$id"]},true);
  const records=Array.isArray(result.records)?result.records as Array<{"$id"?:{value?:string}}>:[];
  return records[0]?.$id?.value||null;
}

export async function syncSubmissionToKintone(row:SubmissionRow,employee:Employee):Promise<SyncResult>{
  if(!["commute_route","bank_account"].includes(row.submission_type))return{status:"skipped",note:"Kintone反映対象外"};
  // 切り替える前（Kintone が正）は、前と同じく名簿の該当欄を直接書く（翌朝の取り込みで戻らないように）
  const direct=await getRosterDirection()!=='garden_to_kintone';
  const push=direct?{warning:undefined as string|undefined}:await queueRosterPush(row.employee_id,'inbox');
  if(!employee.kot_employee_id)return{status:"skipped",note:"KING OF TIME の ID未登録のため名簿更新をスキップ"};
  const targetToken=row.submission_type==="commute_route"?process.env.KINTONE_COMMUTE_TOKEN:process.env.KINTONE_PAYROLL_ACCOUNT_TOKEN;
  if(!process.env.KINTONE_SUBDOMAIN||!targetToken)return{status:"skipped",note:"Kintone環境変数未設定"};
  try{
    const kot=employee.kot_employee_id,p=row.payload,rosterToken=process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN||"",rosterApp=process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID||"56";
    const rosterId=direct?await findRosterId(rosterToken,rosterApp,kot):null;
    if(direct&&!rosterId)return{status:"skipped",note:"KING OF TIME の IDが名簿に無いためKintone反映をスキップ"};
    if(row.submission_type==="commute_route"){
      await call("/k/v1/record.json","POST",`${process.env.KINTONE_COMMUTE_TOKEN||""},${rosterToken}`,{app:process.env.KINTONE_COMMUTE_APP_ID||"93",record:{ルックアップ:v(kot),文字列__1行_:v(employee.name),数値:v(row.proposed_one_way),数値_0:v(employee.commute_monthly_cap),文字列__1行__1:v(p.station)}});
      if(rosterId)await call("/k/v1/record.json","PUT",rosterToken,{app:rosterApp,id:rosterId,record:{交通費_片道:v(row.proposed_one_way),交通費上限:v(employee.commute_monthly_cap)}});
    }else{
      await call("/k/v1/record.json","POST",`${process.env.KINTONE_PAYROLL_ACCOUNT_TOKEN||""},${rosterToken}`,{app:process.env.KINTONE_PAYROLL_ACCOUNT_APP_ID||"92",record:{支払先:v(employee.name),文字列__1行__0:v(employee.name),ルックアップ_0:v(kot),銀行名:v(p.bankName),文字列__1行_:v(p.bankCode),支店名:v(p.branchName),支店コード:v(p.branchCode),種別:v("普通"),口座番号:v(p.accountNumber),口座名義カナ:v(p.holderKana),支払用途:v("給料賃金"),稼働状況:v("○")}});
      if(rosterId)await call("/k/v1/record.json","PUT",rosterToken,{app:rosterApp,id:rosterId,record:{銀行名_1:v(p.bankName),金融機関コード_1:v(p.bankCode),支店コード_1:v(p.branchCode),口座番号_1:v(p.accountNumber)}});
    }
    return{status:push.warning?'failed':'synced',note:push.warning??null};
  }catch(error){const detail=error instanceof Error?error.message:String(error);return{status:"failed",note:`Kintone反映失敗: ${detail.slice(0,200)}`};}
}
