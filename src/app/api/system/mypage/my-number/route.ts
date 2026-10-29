import {requireEmployee} from '@/app/system/mypage/_lib/submission-server';
import {getSupabaseAdmin} from '@/lib/supabase/admin';
import {submitMyNumber} from '@/lib/my-number/submission.server';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
export async function GET(){
 const employee=await requireEmployee();if(!employee)return reply({},401);
 const db=getSupabaseAdmin();
 const [submission,person]=await Promise.all([
 db.from('root_employee_my_numbers').select('my_number_last4,status,submitted_at,rejection_reason').eq('employee_id',employee.employee_id).maybeSingle(),
 db.from('root_employees').select('my_number_deferred_on').eq('employee_id',employee.employee_id).single()
 ]);
 if(submission.error||person.error)return reply({error:'提出の状況を読み込めませんでした。'},503);
 return reply({row:submission.data,prompt:(!submission.data||submission.data.status==='rejected')&&person.data.my_number_deferred_on!==today()});
}
export async function POST(request:Request){
 const employee=await requireEmployee();if(!employee)return reply({},401);
 return submitMyNumber(request,{employee_id:String(employee.employee_id)});
}
export async function PATCH(){
 const employee=await requireEmployee();if(!employee)return reply({},401);
 const {error}=await getSupabaseAdmin().from('root_employees').update({my_number_deferred_on:today()}).eq('employee_id',employee.employee_id);
 return error?reply({error:'記録できませんでした。もう一度お試しください。'},503):reply({ok:true});
}
