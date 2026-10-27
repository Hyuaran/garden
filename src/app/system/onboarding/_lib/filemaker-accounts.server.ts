import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialPassword } from "@/lib/initial-password";
import { sendGardenNotice } from "@/lib/relay/monitor.server";

export const FM_FILES = ["eigyo", "shain", "call", "roster"] as const;
export const FM_LABELS = {eigyo:"【新】営業",shain:"社員情報",call:"コール履歴",roster:"社員情報の名簿"};
export type FileKey = typeof FM_FILES[number];
export type FileState = {status:"waiting"|"sent"|"done"|"failed"; at:string; fm_status?:string; error?:string};
export type AccountRequest = {id:string;hire_candidate_id:string;account_name:string;files:Record<FileKey,FileState>;status:FileState["status"];failure_notified_at:string|null;stuck_notified_at:string|null;updated_at:string};
export type AgentResult = {id:string;file:FileKey;step:"sent"|"checked";fmStatus?:string;error?:string};
const table = "system_filemaker_account_requests";
const nextAt = (previous:string) => new Date(Math.max(Date.now(),Date.parse(previous)+1)).toISOString();
function unwrap<T>({data,error}:{data:T;error:{message:string}|null}):T {if(error)throw new Error(error.message);return data;}
export function overallStatus(files:Record<FileKey,FileState>):FileState["status"] {
 const states=FM_FILES.map(k=>files[k]?.status ?? "waiting");
 return states.every(s=>s==="done")?"done":states.includes("failed")?"failed":states.includes("sent")?"sent":"waiting";
}
export function resultState(previous:FileState,result:AgentResult,at=new Date().toISOString()):FileState {
 if(previous.status==="done")return previous;
 if(result.error)return {status:"failed",at,error:result.error};
 if(result.file==="roster"&&result.fmStatus?.trim())return {status:"done",at,fm_status:result.fmStatus.trim()};
 if(result.step==="sent")return previous.status==="waiting"?{status:"sent",at}:previous;
 const code=result.fmStatus?.trim();
 if(!code || code==="pending")return previous.status==="sent"?previous:{status:"sent",at:previous.at};
 return code==="0"?{status:"done",at,fm_status:code}:{status:"failed",at,fm_status:code,error:`エラー ${code}`};
}
export async function requestFilemakerAccount(db:SupabaseClient,id:string,requestedBy:string) {
 const c=unwrap(await db.from("system_hire_candidates").select("*").eq("id",id).single());
 if(c.status!=="hired")throw new Error("入社済みの方だけ依頼できます");
 const old=unwrap(await db.from(table).select("*").eq("hire_candidate_id",id).maybeSingle()) as AccountRequest|null;
 const at=old?nextAt(old.updated_at):new Date().toISOString();
 const files=Object.fromEntries(FM_FILES.map(k=>[k,old?.files[k]?.status==="done"?old.files[k]:{status:"waiting",at}])) as Record<FileKey,FileState>;
 const values={hire_candidate_id:id,employee_id:c.employee_id ?? null,account_name:c.last_name+"　"+c.first_name,files,status:overallStatus(files),requested_by:requestedBy,updated_at:at};
 // 通知済みは再依頼をまたいで保持し、復旧を一度だけ知らせる。
 return unwrap(await (old?db.from(table).update(values).eq("id",old.id).eq("updated_at",old.updated_at):db.from(table).insert(values)).select().single());
}
export async function agentWork(db:SupabaseClient) {
 const pending=unwrap(await db.from(table).select("*").order("updated_at")) as AccountRequest[];
 for(const row of pending)row.files.roster??={status:"waiting",at:row.updated_at};
 // 失敗のみの古い依頼でキューを塞がず、POST の上限300結果に収める。
 const rows=pending.filter(row=>FM_FILES.some(k=>["waiting","sent"].includes(row.files[k]?.status))).slice(0,40);
 const jobs:{id:string;accountName:string;password:string;files:FileKey[];roster?:Record<string,string>}[]=[];
 const checks:{id:string;files:FileKey[]}[]=[];
 for(const row of rows){
  const waiting=FM_FILES.filter(k=>row.files[k]?.status==="waiting");
  const sent=FM_FILES.filter(k=>row.files[k]?.status==="sent");
  if(waiting.length){
   const c=unwrap(await db.from("system_hire_candidates").select("*").eq("id",row.hire_candidate_id).single());
   const roster={lastName:c.last_name,firstName:c.first_name,lastNameKana:c.last_name_kana,firstNameKana:c.first_name_kana,employmentType:c.employment_type,employeeNumber:c.employee_number,hireDate:c.hire_date};
   const files={...row.files};
   const at=nextAt(row.updated_at);
   if(waiting.includes("roster")&&(c.status!=="hired"||Object.values(roster).some(v=>typeof v!=="string"||!v.trim())||!["正社員","アルバイト","役員","派遣","パートナー"].includes(roster.employmentType)||!/^\d{4}-\d{2}-\d{2}$/.test(roster.hireDate))){
    files.roster={status:"failed",at,error:"入社情報（社員番号・カナ）を確認してください"};
   }
   const password=initialPassword(c?.birthday);
   if(!password || c?.status!=="hired"){
    for(const file of waiting)if(file!=="roster")files[file]={status:"failed",at,error:"入社情報（誕生日）を確認してください"};
   }
   if(waiting.some(k=>files[k].status==="failed")){
    const saved=unwrap(await db.from(table).update({files,status:overallStatus(files),updated_at:at}).eq("id",row.id).eq("updated_at",row.updated_at).select("id").maybeSingle());
    if(!saved)continue;
    await reconcileRequest(db,row.id);
   }
   const ready=waiting.filter(k=>files[k].status==="waiting");
   if(ready.length)jobs.push({id:row.id,accountName:row.account_name,password:password??"",files:ready,...(ready.includes("roster")?{roster}:{})});
  }
  if(sent.length)checks.push({id:row.id,files:sent});
 }
 return {jobs,checks};
}
export function notificationKind(row:AccountRequest,now=Date.now()) {
 const status=overallStatus(row.files);
 if(status==="failed"&&!row.failure_notified_at)return "failure";
 if(status==="done"&&(row.failure_notified_at||row.stuck_notified_at))return "recovery";
 if((status==="waiting"||status==="sent")&&!row.stuck_notified_at&&FM_FILES.some(k=>["waiting","sent"].includes(row.files[k]?.status??"waiting")&&now-Date.parse(row.files[k]?.at??row.updated_at)>30*60_000))return "stuck";
 return null;
}
export async function reconcileRequest(db:SupabaseClient,id:string) {
 const row=unwrap(await db.from(table).select("*").eq("id",id).single()) as AccountRequest;
 if(row.status==="done"&&overallStatus(row.files)==="done"){
  // 手動チェックとの競合時は再読み込みしてマージする。
  for(let attempt=0;attempt<3;attempt++){
   const c=unwrap(await db.from("system_hire_candidates").select("checklist").eq("id",row.hire_candidate_id).single());
   if(!c)throw new Error("入社情報がありません");
   if(c.checklist?.filemaker_added)break;
   const saved=unwrap(await db.from("system_hire_candidates").update({checklist:{...c.checklist,filemaker_added:{checked_at:new Date().toISOString(),checked_by:"自動（FileMaker）"}}}).eq("id",row.hire_candidate_id).is("checklist->filemaker_added",null).select("id").maybeSingle());
   if(saved)break;
   if(attempt===2)throw new Error("確認欄の更新が競合しました");
  }
 }
 const kind=notificationKind(row);if(!kind)return;
 const at=nextAt(row.updated_at);
 const patch=kind==="failure"?{failure_notified_at:at}:kind==="stuck"?{stuck_notified_at:at}:{failure_notified_at:null,stuck_notified_at:null};
 // 同じスナップショットの通知権を一つの呼び出しだけが取得する。
 const claimed=unwrap(await db.from(table).update({...patch,updated_at:at}).eq("id",id).eq("updated_at",row.updated_at).select("id").maybeSingle());
 if(!claimed)return;
 const details=FM_FILES.filter(k=>row.files[k]?.status==="failed").map(k=>`${FM_LABELS[k]}：${row.files[k].error}`).join("、");
 const body=kind==="failure"?`FileMaker のアカウントを作れませんでした：${row.account_name}（${details}）。入社手続き（事務）の画面から［もう一度］を押すか、FileMaker で手で作ってください。`:kind==="recovery"?`FileMaker のアカウントを作れました：${row.account_name}。`:`FileMaker のアカウント作成が30分以上止まっています：${row.account_name}。ホストPC か FileMaker の定時処理が止まっていないか確認してください。`;
 try{if(await sendGardenNotice(body)===false)throw new Error("通知が設定されていません");}catch{
  unwrap(await db.from(table).update({failure_notified_at:row.failure_notified_at,stuck_notified_at:row.stuck_notified_at,updated_at:new Date().toISOString()}).eq("id",id).eq("updated_at",at).select("id"));
 }
}
export function parseAgentResults(body:unknown):AgentResult[]{
 const results=(body as {results?:unknown})?.results;
 if(!Array.isArray(results)||results.length>300||results.some(r=>!r||typeof r.id!=="string"||! /^[0-9a-f-]{36}$/i.test(r.id)||!FM_FILES.includes(r.file)||!["sent","checked"].includes(r.step)||(r.fmStatus!==undefined&&(typeof r.fmStatus!=="string"||r.fmStatus.length>100))||(r.error!==undefined&&(typeof r.error!=="string"||r.error.length>1000))))throw new Error("結果の形式が正しくありません");
 return results;
}
export async function applyAgentResults(db:SupabaseClient,results:AgentResult[]) {
 for(const id of new Set(results.map(r=>r.id))){
  let saved=false;
  for(let attempt=0;attempt<5;attempt++){
   const row=unwrap(await db.from(table).select("*").eq("id",id).single()) as AccountRequest;
   const files={...row.files,roster:row.files.roster??{status:"waiting" as const,at:row.updated_at}};const at=nextAt(row.updated_at);
   for(const r of results.filter(r=>r.id===id))files[r.file]=resultState(files[r.file],r,at);
   const updated=unwrap(await db.from(table).update({files,status:overallStatus(files),updated_at:at}).eq("id",id).eq("updated_at",row.updated_at).select("id").maybeSingle());
   if(updated){saved=true;break;}
  }
  if(!saved)throw new Error("更新が競合しました。再実行してください");
  await reconcileRequest(db,id);
 }
}
export async function checkFilemakerRequests(db:SupabaseClient){
 const since=new Date(Date.now()-2*24*60*60_000).toISOString();
 const rows=unwrap(await db.from(table).select("id").or(`status.in.(waiting,sent,failed),and(status.eq.done,updated_at.gte.${since})`)) ?? [];
 for(const row of rows)await reconcileRequest(db,row.id);
 return {ok:true,checked:rows.length};
}
