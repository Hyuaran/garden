import { HireError, hireResponse } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { requestFilemakerAccount, reconcileRequest } from "@/app/system/onboarding/_lib/filemaker-accounts.server";
import { signaturesComplete, lineComplete } from "@/app/system/onboarding/_lib/hire-candidates";
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return hireResponse(async c=>{
  const {data:row,error}=await c.db.from("system_hire_candidates").select("status,checklist,line_verified_at").eq("id",id).single();
  if(error||!row)throw new HireError("入社情報を読み込めませんでした",503);
  if(row.status!=="hired"||!signaturesComplete(row))throw new HireError("①の締結がそろうと進めます",409);
  if(!lineComplete(row))throw new HireError("②の LINE 確認が済むと進めます",409);
  return requestFilemakerAccount(c.db,id,c.userId);
 });
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 return hireResponse(async c=>{
  const {data,error}=await c.db.from("system_filemaker_account_requests").select("id").eq("hire_candidate_id",id).maybeSingle();
  if(error)throw new HireError("状態を読み込めませんでした",503);
  if(data)await reconcileRequest(c.db,data.id);
  const result=await c.db.from("system_filemaker_account_requests").select("status,files").eq("hire_candidate_id",id).maybeSingle();
  if(result.error)throw new HireError("状態を読み込めませんでした",503);
  return {ok:true,request:result.data};
 });
}
