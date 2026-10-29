import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ROSTER_CHOICES, ROSTER_FIELDS } from './roster-fields';
import { currentTeam, type TeamHistory } from './team-history';
import { isRetiredByDate } from '@/lib/auth/employee-access';

type Payload = Record<string, unknown>;
type Options = { supabase?: SupabaseClient; fetchImpl?: typeof fetch };
export const ROSTER_RETRY_WARNING = 'Kintone への写しは後で送り直します';
export async function getRosterDirection(db = getSupabaseAdmin()) {
  const { data, error } = await db.from('root_roster_settings').select('direction').eq('id', true).single();
  if (error) throw error;
  return data.direction as 'kintone_to_garden' | 'garden_to_kintone';
}

export function mapEmployeeToRosterRecord(employee: Payload, profiles: Record<string, Payload>, teams?: TeamHistory[]) {
  profiles = {
    bank_account: Object.fromEntries(Object.entries({bank_name:'bank_name',bank_code:'bank_code',branch_name:'branch_name',branch_code:'branch_code',account_type:'account_type',account_number:'account_number',holder_kana:'account_holder_kana'}).flatMap(([key,column]) => employee[column] === undefined ? [] : [[key,employee[column]]])),
    commute: {...(typeof employee.commute_daily_allowance === 'number' ? {one_way:employee.commute_daily_allowance / 2} : {}),...(employee.commute_monthly_cap !== undefined ? {monthly_cap:employee.commute_monthly_cap} : {})},
    ...profiles,
  };
  const record: Record<string, { value: unknown }> = {};
  const errors: string[] = [];
  const put = (code: string, value: unknown) => {
    if (value === undefined) return;
    if (value != null && value !== '' && ROSTER_CHOICES[code] && !ROSTER_CHOICES[code].includes(String(value))) {
      errors.push(`${code}：Kintone の選択肢にない値（${value}）`); return;
    }
    record[code] = { value: value ?? '' };
  };
  for (const [category, fields] of Object.entries(ROSTER_FIELDS)) {
    const payload = category === 'sub_account' ? profiles.bank_account?.sub_account as Payload : profiles[category];
    if (!payload) continue;
    for (const [key, code] of Object.entries(fields)) {
      if (['round_trip', 'salary_system', 'team', 'employment_type', 'hire_date'].includes(key)) continue;
      let value = payload[key];
      if (key === 'account_type') value = ({ ordinary: '普通', current: '当座' } as Payload)[String(value)] ?? value;
      put(code, value);
    }
  }
  for (const [key, code] of Object.entries({ name:'従業員名_姓名',name_kana:'従業員名_姓名カナ',birthday:'生年月日',hire_date:'入社日',termination_date:'退職日',kot_employee_id:'打刻ID',email:'メールアドレス' })) put(code, employee[key]);
  put('雇用形態', employee.employment_type === 'outsource' ? 'パートナー' : employee.employment_type);
  put('従業員ステータス', employee.is_active === false || isRetiredByDate(employee.termination_date as string | null) ? '退職済み' : '在籍中');
  for (const [key, codes] of [['name',['従業員名_姓','従業員名_名']]] as const) {
    const parts = String(employee[key] ?? '').trim().split(/[\s　]+/);
    if (parts.length === 2) { put(codes[0], parts[0]); put(codes[1], parts[1]); }
  }
  const rosterTeam = (team: string) => team === '新人チーム' ? 'ヒュアラングループ' : team;
  if (teams) {
    put('チーム名', rosterTeam(currentTeam(teams) ?? '所属なし'));
    put('テーブル', teams.flatMap(row => {
      const team = rosterTeam(row.team);
      if (!ROSTER_CHOICES.チーム名.includes(team)) { errors.push(`チーム名：Kintone の選択肢にない値（${team}）`); return []; }
      return [{ value: { 日付_8:{value:row.effective_date},ドロップダウン_17:{value:team},文字列__複数行_:{value:row.memo ?? ''} } }];
    }));
  }
  return { record, errors };
}

class MissingRosterRecord extends Error {}
export async function pushEmployeeToRoster(employeeId: string, options: Options = {}) {
  const db = options.supabase ?? getSupabaseAdmin();
  // Enforce the switch even for direct callers.
  if (await getRosterDirection(db) !== 'garden_to_kintone') return { held: true, errors: [] };
  const employee = await db.from('root_employees').select('*').eq('employee_id', employeeId).single();
  if (employee.error) throw employee.error;
  const profiles = await db.from('root_employee_profile_current').select('category,payload').eq('employee_id',employeeId);
  if (profiles.error) throw profiles.error;
  const teams = await db.from('root_employee_team_history').select('*').eq('employee_id',employeeId).order('effective_date').order('entered_at').order('id');
  if (teams.error) throw teams.error;
  const mapped = mapEmployeeToRosterRecord(employee.data, Object.fromEntries((profiles.data ?? []).map(r => [r.category,r.payload])), teams.data ?? []);
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN;
  const sub = process.env.KINTONE_SUBDOMAIN;
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || '56';
  if (!token || !sub) throw new Error('Kintone環境変数未設定');
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { 'content-type':'application/json','X-Cybozu-API-Token':token };
  let id = employee.data.roster_record_id;
  if (!id) {
    const kot = employee.data.kot_employee_id;
    if (!kot) throw new MissingRosterRecord('打刻IDがありません');
    const query = `打刻ID = "${String(kot).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}" order by 作成日時 desc limit 1`;
    const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/records.json?${new URLSearchParams({app,query,'fields[0]':'$id'})}`, {headers,cache:'no-store',signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`名簿検索失敗: ${response.status}`);
    id = (await response.json()).records?.[0]?.$id?.value;
    if (!id) throw new MissingRosterRecord('打刻IDが名簿にありません');
    const saved = await db.from('root_employees').update({roster_record_id:id}).eq('employee_id',employeeId);
    if (saved.error) throw saved.error;
  }
  if (await getRosterDirection(db) !== 'garden_to_kintone') return { held:true,errors:[] };
  const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/record.json`, {method:'PUT',headers,body:JSON.stringify({app,id,record:mapped.record}),cache:'no-store',signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`名簿更新失敗: ${response.status}`);
  return { held:false, errors:mapped.errors };
}

async function sendQueueRow(row: {id:string;employee_id:string;attempts:number;requested_at:string}, options: Options) {
  const db = options.supabase ?? getSupabaseAdmin();
  const claim = await db.rpc('root_claim_roster_push',{p_id:row.id});
  if (claim.error) throw claim.error;
  if (!claim.data) return ROSTER_RETRY_WARNING;
  let update: Payload;
  try {
    const result = await pushEmployeeToRoster(row.employee_id, options);
    update = {status:result.held ? 'held':'done',done_at:result.held ? null:new Date().toISOString(),last_error:result.errors.join('\n') || null};
  } catch (error) {
    const attempts = row.attempts + 1;
    update = {attempts,status: error instanceof MissingRosterRecord || attempts >= 5 ? 'failed':'pending',last_error:error instanceof Error ? error.message:String(error)};
  }
  const saved = await db.from('root_roster_push_queue').update(update).eq('id',row.id).eq('requested_at',row.requested_at);
  if (saved.error) throw saved.error;
  const released = await db.from('root_roster_push_queue').update({lease_until:null}).eq('id',row.id);
  if (released.error) throw released.error;
  return update.status === 'pending' || update.status === 'failed' ? ROSTER_RETRY_WARNING : undefined;
}

export async function queueRosterPush(employeeId: string, reason: string, options: Options = {}) {
  const db = options.supabase ?? getSupabaseAdmin();
  try {
    const direction = await getRosterDirection(db);
    const queued = await db.rpc('root_enqueue_roster_push',{p_employee_id:employeeId,p_reason:reason,p_status:direction === 'garden_to_kintone' ? 'pending':'held'});
    if (queued.error) throw queued.error;
    if (direction === 'kintone_to_garden') return {status:'held' as const};
    const row = await db.from('root_roster_push_queue').select('*').eq('id',queued.data).single();
    if (row.error) throw row.error;
    const warning = await sendQueueRow(row.data, {...options,supabase:db});
    return {status:warning ? 'pending' as const:'done' as const,warning};
  } catch (error) {
    console.error('roster_push_queue_failed',error);
    return {status:'pending' as const,warning:ROSTER_RETRY_WARNING};
  }
}

export async function retryRosterPushes(options: Options = {}) {
  const db = options.supabase ?? getSupabaseAdmin();
  if (await getRosterDirection(db) !== 'garden_to_kintone') return {sent:0};
  const rows = await db.from('root_roster_push_queue').select('*').in('status',['pending','held']).order('requested_at');
  if (rows.error) throw rows.error;
  for (const row of rows.data ?? []) await sendQueueRow(row,{...options,supabase:db});
  return {sent:rows.data?.length ?? 0};
}
