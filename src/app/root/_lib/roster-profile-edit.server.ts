import type { SupabaseClient } from '@supabase/supabase-js';
import { ROSTER_FIELDS } from './roster-fields';

export function validProfileChanges(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  return Object.entries(input).every(([category,payload]) => {
    if (!['address','contact','bank_account','commute','employment'].includes(category) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    return Object.entries(payload).every(([key,value]) => {
      if (category === 'bank_account' && key === 'sub_account') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([k,v]) => k in ROSTER_FIELDS.sub_account && (v === null || typeof v === 'string' && v.length <= 5000));
      return key in ROSTER_FIELDS[category] && !['round_trip','salary_system','team'].includes(key) && (value === null || typeof value === 'string' && value.length <= 5000 || typeof value === 'number' && Number.isFinite(value));
    });
  });
}

export function mergeProfileChanges(current: Record<string,unknown>, patch: Record<string,unknown>): Record<string,unknown> {
  return {...current,...patch,...(patch.sub_account ? {sub_account:{...(current.sub_account as object ?? {}),...patch.sub_account as object}} : {})};
}
export async function saveProfileChanges(db: SupabaseClient,employeeId: string,changes: Record<string,Record<string,unknown>>,actorId: string) {
  for (const [category,patch] of Object.entries(changes)) {
    const latest = await db.from('root_employee_profile_current').select('payload').eq('employee_id',employeeId).eq('category',category).maybeSingle();
    if (latest.error) throw latest.error;
    const current = latest.data?.payload ?? {};
    const payload = mergeProfileChanges(current,patch);
    if (Object.keys(patch).every(key => JSON.stringify(payload[key] ?? null) === JSON.stringify(current[key] ?? null))) continue;
    const saved = await db.from('root_employee_profile_history').insert({employee_id:employeeId,category,payload,source:'admin',recorded_by:actorId,effective_from:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})});
    if (saved.error) throw saved.error;
  }
}
