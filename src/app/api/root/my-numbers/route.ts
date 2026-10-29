import {getSupabaseAdmin} from '@/lib/supabase/admin';
import {myNumberViewer,logMyNumberAccess} from '@/lib/my-number/access.server';
import {decryptMyNumber,type EncryptedMyNumber} from '@/lib/my-number/crypto.server';
import {pushLineStaff} from '@/lib/line/staff-client';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
export async function POST(request:Request) {
 const actor=await myNumberViewer();if(!actor)return reply({},404);
 if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site')return reply({},403);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.employee_id!=='string'||!['detail','display','confirm','reject'].includes(body.action))return reply({},400);
 const db=getSupabaseAdmin();
 try {
  const {data,error}=await db.from('root_employee_my_numbers').select('my_number_cipher,my_number_iv,my_number_tag,my_number_last4,key_version,photo_path,submitted_at').eq('employee_id',body.employee_id).maybeSingle();
  if(error)throw error;if(!data)return reply({},404);
  if(body.action==='detail') {
   if(!data.photo_path)return reply({photoUrl:null});
   const {data:photo,error}=await db.storage.from('my-number-photos').createSignedUrl(data.photo_path,60);
   if(error)throw error;return reply({photoUrl:photo.signedUrl});
  }
  if(body.action==='display') {
   await logMyNumberAccess(actor,body.employee_id,'display');
   return reply({number:decryptMyNumber(data as EncryptedMyNumber)});
  }
  if(body.action==='reject'&&(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000))return reply({error:'差し戻す理由を入力してください。'},400);
  // 更新と記録は同じトランザクション。古い小窓から新しい提出を確認しない。
  if(body.submitted_at!==data.submitted_at)return reply({error:'提出内容が変わりました。画面を開き直してください。'},409);
  const {error:reviewError}=await db.rpc('review_my_number',{p_actor:actor,p_employee_id:body.employee_id,p_submitted_at:body.submitted_at,p_action:body.action,p_reason:body.action==='reject'?body.reason.trim():null});
  if(reviewError)throw reviewError;
  let notification='disabled';
  if(body.action==='reject'&&process.env.MY_NUMBER_RETURN_LINE_ENABLED==='true') {
   const {data:employee,error:employeeError}=await db.from('root_employees').select('line_user_id').eq('employee_id',body.employee_id).maybeSingle();
   notification='failed';
   if(!employeeError&&employee?.line_user_id) {
    try {await pushLineStaff([employee.line_user_id],'マイナンバーをもう一度提出してください。\n理由：'+body.reason.trim());notification='sent';}catch{/* 保存済みの差し戻し結果は保持する。 */}
   }
  }
  return reply({ok:true,notification});
 }catch{return reply({error:'操作を完了できませんでした。時間をおいてもう一度お試しください。'},503);}
}
