import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireEmployee } from '@/app/system/mypage/_lib/submission-server';
import { automaticTags, chooseGreeting, personalize, type Employee, type Tag, type Member, type Greeting } from './tags';

export async function requireLineAdmin() {
  const e = await requireEmployee();
  if (!e) return null;
  const { data, error } = await getSupabaseAdmin().from('root_employees').select('garden_role').eq('employee_id', e.employee_id).single();
  if (error || data?.garden_role !== 'super_admin') return null;
  return e;
}
export function checked<T extends { error: unknown }>(r: T): T { if(r.error) throw r.error; return r; }
async function allRows<T>(table: string, columns: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for(let offset=0;;offset+=1000) {
    const result = checked(await getSupabaseAdmin().from(table).select(columns).order(order).range(offset,offset+999));
    const page = result.data as T[]; rows.push(...page); if(page.length<1000) return rows;
  }
}
export async function loadLineData(sync = true, employeeId?: string) {
  const db=getSupabaseAdmin();
  const [tags, employees, greetings] = await Promise.all([
    allRows<Tag>('system_line_tag','*','id'),
    allRows<Employee & { deleted_at?: string }>('root_employees_with_team','employee_id,employee_number,name,employment_type,garden_role,hire_date,termination_date,is_active,line_user_id,line_link_source,line_contact_url,deleted_at,business,current_team','employee_id'),
    allRows<Greeting>('system_line_greeting','*','id'),
  ]);
  const activeRows=employees.filter(e=>!e.deleted_at);
  if(sync) {
    checked(await db.rpc(employeeId ? 'system_line_replace_employee_auto' : 'system_line_replace_auto',{ ...(employeeId ? {p_employee:employeeId} : {}), p_members:activeRows.filter(e=>!employeeId || e.employee_id===employeeId).flatMap(e=>automaticTags(e,tags)) }));
  }
  const members=await allRows<Member>('system_line_tag_member','*','employee_id');
  const history=checked(await db.from('system_line_broadcast').select('*').order('created_at',{ascending:false}).limit(100)).data;
  return { tags: tags.sort((a,b)=>a.sort-b.sort), employees:activeRows, greetings, members, history, updatedAt:new Date().toISOString() };
}
export async function linkedGreeting(employeeNumber: string) {
  const db=getSupabaseAdmin();
  const e=checked(await db.from('root_employees_with_team').select('*').eq('employee_number',employeeNumber).single()).data as Employee;
  const tags=await allRows<Tag>('system_line_tag','*','id');
  const manual=checked(await db.from('system_line_tag_member').select('*').eq('employee_id',e.employee_id).eq('source','manual')).data as Member[];
  const greetings=await allRows<Greeting>('system_line_greeting','*','id');
  const g=chooseGreeting(greetings,[...manual,...automaticTags(e,tags)].map(m=>m.tag_id));
  return g ? personalize(g.body,e.name) : undefined;
}
