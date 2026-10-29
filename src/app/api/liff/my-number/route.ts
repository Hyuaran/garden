import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyLiffEmployee } from '@/lib/line/liff-verify.server';
import { submitMyNumber } from '@/lib/my-number/submission.server';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request: Request) {
  const employee = await verifyLiffEmployee(request.headers.get('authorization')?.replace(/^Bearer /i,''),'forms');
  if(employee instanceof Response) return employee;
  const {data,error} = await getSupabaseAdmin().from('root_employee_my_numbers').select('my_number_last4,status,submitted_at,rejection_reason').eq('employee_id',employee.employee_id).maybeSingle();
  return error ? reply({error:'提出の状況を読み込めませんでした。'},503) : reply({name:employee.name,row:data});
}
export async function POST(request:Request){const employee=await verifyLiffEmployee(request.headers.get('authorization')?.replace(/^Bearer /i,''),'forms');if(employee instanceof Response)return employee;return submitMyNumber(request,employee);}
