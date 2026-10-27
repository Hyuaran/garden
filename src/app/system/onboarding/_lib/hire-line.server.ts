import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { pushLineStaff } from "@/lib/line/staff-client";
import { HireError, hireAdminContext } from "./hire-candidates.server";
import { signaturesComplete } from "./hire-candidates";

export const codeHash = (salt:string, code:string) => createHash("sha256").update(salt+":"+code).digest("hex");
export function createLineCode() {
 const code=String(randomInt(1_000_000)).padStart(6,"0"),salt=randomBytes(32).toString("hex");
 return {code,salt,code_hash:codeHash(salt,code),expires_at:new Date(Date.now()+24*60*60_000).toISOString()};
}
export async function checkHireLine(context:Awaited<ReturnType<typeof hireAdminContext>>, id:string, body:{action?:string;code?:string}) {
 const {db,userId}=context;
 const {data:c,error}=await db.from("system_hire_candidates").select("status,employee_id,checklist").eq("id",id).single();
 if(error||!c||c.status!=="hired")throw new HireError("入社済みの方だけ確認できます",409);
 if(!signaturesComplete(c))throw new HireError("①の締結がそろうと進めます",409);
 if(body.action==="send") {
  const {data:e,error:ee}=await db.from("root_employees").select("line_user_id").eq("employee_id",c.employee_id).is("deleted_at",null).single();
  if(ee||!e?.line_user_id)throw new HireError("まだ LINE を連携していません（入社手続きの最後のページの QR から登録）",409);
  const {code,...saved}=createLineCode();
  const {error:saveError}=await db.from("system_hire_line_checks").upsert({hire_candidate_id:id,...saved,attempts:0});
  if(saveError)throw new HireError("確認コードを準備できませんでした",503);
  try { await pushLineStaff([e.line_user_id],`Garden からのテスト送信です。\n確認コード：${code}`); }
  catch {
   await db.from("system_hire_line_checks").delete().eq("hire_candidate_id",id).eq("salt",saved.salt);
   throw new HireError("LINE に送信できませんでした。友だち登録・ブロックの状態や送信設定を確認して、もう一度送ってください",503);
  }
  return {sent:true};
 }
 if(body.action!=="verify"||!/^\d{6}$/.test(body.code??""))throw new HireError("確認コードを6桁で入力してください");
 const {data:check,error:readError}=await db.from("system_hire_line_checks").select("salt").eq("hire_candidate_id",id).maybeSingle();
 if(readError)throw new HireError("確認コードを読み込めませんでした",503);
 if(!check)throw new HireError("期限が切れました。もう一度送ってください",409);
 const {data:result,error:verifyError}=await db.rpc("verify_hire_line_code",{candidate_id:id,digest:codeHash(check.salt,body.code!),actor:userId});
 if(verifyError)throw new HireError("確認できませんでした。もう一度お試しください",503);
 if(result!=="ok")throw new HireError(String(result),409);
 return {verified:true};
}
