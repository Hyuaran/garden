import { NextResponse } from 'next/server';
import { verifyLiffEmployee } from '@/lib/line/liff-verify.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createSubmission } from '@/app/system/mypage/_lib/create-submission.server';
export const runtime = 'nodejs';
const types = ['commute_route', 'bank_account'];
const headers = {'Cache-Control':'no-store'};
async function authenticate(request: Request, body?: {idToken?: unknown} | null) {
 return verifyLiffEmployee(request.headers.get('authorization')?.replace(/^Bearer /i, '') || body?.idToken);
}
export async function GET(request: Request) {
 const employee = await authenticate(request);
 if (employee instanceof Response) return employee;
 const {data, error} = await getSupabaseAdmin().from('system_mypage_submissions')
 .select('id,submission_type,status,created_at').eq('employee_id', employee.employee_id)
 .in('submission_type', types).order('created_at', {ascending:false}).limit(10);
 return NextResponse.json(error ? {ok:false,error:'申告を読み込めませんでした。'} : {ok:true,name:employee.name,rows:data}, {status:error?500:200,headers});
}
export async function POST(request: Request) {
 const body = await request.json().catch(()=>null);
 const employee = await authenticate(request, body);
 if (employee instanceof Response) return employee;
 if (!body || !types.includes(body.submission_type)) return NextResponse.json({ok:false,error:'届出の種類を確認してください。'}, {status:400,headers});
 const {data: allowed,error} = await getSupabaseAdmin().rpc('consume_liff_submission_limit', {p_employee_id:employee.employee_id});
 if (error) return NextResponse.json({ok:false,error:'送信できませんでした。'}, {status:503,headers});
 if (!allowed) return NextResponse.json({ok:false,error:'少し時間をおいてから送信してください'}, {status:429,headers:{...headers,'Retry-After':'60'}});
 const response = await createSubmission(employee, {type:body.submission_type,payload:body.payload});
 response.headers.set('Cache-Control','no-store');
 return response;
}
