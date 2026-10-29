import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
export async function myNumberRows() {
 const db=getSupabaseAdmin();
 const employees: Array<{employee_id:string;employee_number:string|null;name:string|null}>=[];
 const numbers: Array<{employee_id:string;my_number_last4:string|null;submitted_at:string;status:string;source:string;photo_path:string|null;rejection_reason:string|null}>=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('root_employees').select('employee_id,employee_number,name').is('deleted_at',null).eq('is_active',true).order('employee_id').range(offset,offset+999);
  if(error)throw new Error('従業員を読み込めませんでした。');employees.push(...data);if(data.length<1000)break;
 }
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('root_employee_my_numbers').select('employee_id,my_number_last4,submitted_at,status,source,photo_path,rejection_reason').order('employee_id').range(offset,offset+999);
  if(error)throw new Error('提出の状況を読み込めませんでした。');numbers.push(...data);if(data.length<1000)break;
 }
 const map=new Map(numbers.map(row=>[row.employee_id,row]));
 return employees.map(employee=>{const row=map.get(employee.employee_id);return {...employee,last4:row?.my_number_last4||'',submitted_at:row?.submitted_at||'',status:row?.my_number_last4?(row.status==='confirmed'?'confirmed':'pending'):'missing',source:row?.source||'',hasPhoto:!!row?.photo_path,rejection_reason:row?.rejection_reason||''};});
}
export type MyNumberRow = Awaited<ReturnType<typeof myNumberRows>>[number];
