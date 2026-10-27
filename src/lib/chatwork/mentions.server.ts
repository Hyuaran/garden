import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function chatworkToLine(employeeIds: string[]): Promise<{ line: string; missing: string[] }> {
  if (!employeeIds.length) return { line: '', missing: [] };
  const { data, error } = await getSupabaseAdmin()
    .from('root_employees')
    .select('employee_id,chatwork_account_id')
    .in('employee_id', [...new Set(employeeIds)])
    .is('deleted_at', null);
  if (error) throw error;
  const accounts = new Map<string, string | null>((data ?? []).map(row => [row.employee_id, row.chatwork_account_id]));
  const seen = new Set<string>(), missing: string[] = [], tags: string[] = [];
  for (const employeeId of new Set(employeeIds)) {
    const id = accounts.get(employeeId);
    if (!id) { missing.push(employeeId); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    tags.push(`[To:${id}]`);
  }
  return { line: tags.join(''), missing };
}