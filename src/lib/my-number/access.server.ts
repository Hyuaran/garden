import 'server-only';
import { viewPermissionContext } from '@/lib/auth/view-permission.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function isMyNumberViewer(employeeId: string) {
  try {
    const {data,error} = await getSupabaseAdmin().from('my_number_viewers').select('employee_id').eq('employee_id',employeeId).maybeSingle();
    return !error && !!data;
  } catch { return false; }
}
export async function myNumberViewer() {
  try {
    const context = await viewPermissionContext();
    return await isMyNumberViewer(context.viewer.employeeId) ? context.viewer.employeeId : null;
  } catch { return null; }
}
export async function logMyNumberAccess(actor: string, target: string, action: 'display'|'confirm'|'reject', detail: string|null = null) {
  const {error} = await getSupabaseAdmin().from('my_number_access_logs').insert({actor_employee_id:actor,employee_id:target,action,detail});
  if(error) throw new Error('番号の操作を記録できませんでした。');
}
