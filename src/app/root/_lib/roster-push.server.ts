import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ROSTER_CHOICES, ROSTER_FIELDS } from './roster-fields';
import { currentTeam, type TeamHistory } from './team-history';
import { isRetiredByDate } from '@/lib/auth/employee-access';

type Payload = Record<string, unknown>;
export type RosterRecord = Record<string, { value: unknown }>;
type Options = { supabase?: SupabaseClient; fetchImpl?: typeof fetch; dryRun?: boolean; currentRecord?: RosterRecord };
const normalize = (value: unknown) => String(value ?? '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
const numericCode = (code: string) => /^(連絡先(?:_[1-3])?|文字列__1行__1[567]|郵便番号|口座番号(?:_[12])?|金融機関コード(?:_[12])?|支店コード(?:_[12])?)$/.test(code);
const digits = (value: unknown) => normalize(value).replace(/\D/g, '');
export function sameRosterValue(code: string, kintoneValue: unknown, gardenValue: unknown) {
  if (!normalize(gardenValue)) return true;
  if (numericCode(code)) return digits(kintoneValue) === digits(gardenValue);
  const clean = (value: unknown) => code.startsWith('従業員名_') ? normalize(value).replace(/[\s　]+/g, '') : normalize(value);
  return clean(kintoneValue) === clean(gardenValue);
}
export function formatRosterValue(code: string, current: unknown, next: unknown) {
  if (!numericCode(code)) return next;
  let result = digits(next);
  const pattern = normalize(current);
  for (let i = 0; i < pattern.length; i++) if (pattern[i] === '-' && i < result.length) result = result.slice(0, i) + '-' + result.slice(i);
  return result;
}
// Kintone の「ヒュアラングループ」は、Garden では新人チームか所属なしとして取り込んでいる
const sameTeam = (kintone: unknown, garden: unknown) => kintone === garden || kintone === 'ヒュアラングループ' && ['新人チーム', '所属なし'].includes(String(garden));
// 口座は、Garden の画面（Root の編集・届出）で直したときだけ送る（口座一覧・名簿から来た値は Kintone と口座の並びが違う）
const BANK_SOURCES = ['admin', 'submission'];
export function diffRosterRecord(employee: Payload, mapped: RosterRecord, current: RosterRecord, addressSource: unknown, teams: TeamHistory[], bankSource?: unknown) {
  const record: RosterRecord = {};
  const changes: {code: string; from: unknown; to: unknown}[] = [];
  const skipped: string[] = [];
  for (const [code, field] of Object.entries(mapped)) {
    const from = current[code]?.value;
    let to = field.value;
    let skip = code === '打刻ID' || code === 'メールアドレス' && /@garden\.internal$/i.test(normalize(to))
      || Object.values(ROSTER_FIELDS.address).includes(code) && addressSource !== 'admin'
      || [...Object.values(ROSTER_FIELDS.bank_account), ...Object.values(ROSTER_FIELDS.sub_account)].includes(code) && !BANK_SOURCES.includes(String(bankSource))
      || ['従業員名_姓','従業員名_名'].includes(code) && sameRosterValue('従業員名_姓名', current.従業員名_姓名?.value, employee.name);
    if (code === 'チーム名') skip ||= sameTeam(from, currentTeam(teams) ?? '所属なし');
    if (code === 'テーブル') {
      const rows = (Array.isArray(from) ? from : []) as {id?: string; value: RosterRecord}[];
      const additions: {value: RosterRecord}[] = [];
      for (const row of teams.filter(r => r.source === 'garden')) {
        if ([...rows, ...additions].some(r => r.value.日付_8?.value === row.effective_date && sameTeam(r.value.ドロップダウン_17?.value, row.team))) continue;
        const team = row.team === '新人チーム' ? 'ヒュアラングループ' : row.team;
        if (!ROSTER_CHOICES.チーム名.includes(team)) continue;
        additions.push({value:{日付_8:{value:row.effective_date},ドロップダウン_17:{value:team},文字列__複数行_:{value:row.memo ?? ''}}});
      }
      skip ||= additions.length === 0;
      to = [...rows, ...additions];
    } else skip ||= sameRosterValue(code, from, to);
    if (skip) { skipped.push(code); continue; }
    to = formatRosterValue(code, from, to);
    record[code] = {value:to};
    changes.push({code, from:from ?? '', to});
  }
  return {record, changes, skipped};
}
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
    if (!normalize(value)) { record[code] = {value:''}; return; }
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
  // 銀行名_1 が Kintone の選択肢にない（楽天銀行以外）ときは、口座1をまるごと送らない（コードだけ別の銀行になるのを防ぐ）
  if (errors.some(error => error.startsWith('銀行名_1：'))) for (const code of Object.values(ROSTER_FIELDS.bank_account)) delete record[code];
  return { record, errors };
}

class MissingRosterRecord extends Error {}
export async function pushEmployeeToRoster(employeeId: string, options: Options = {}) {
  const db = options.supabase ?? getSupabaseAdmin();
  // Enforce the switch even for direct callers.
  if (!options.dryRun && await getRosterDirection(db) !== 'garden_to_kintone') return { held: true, errors: [], changes: [], skipped: [] };
  const employee = await db.from('root_employees').select('*').eq('employee_id', employeeId).single();
  if (employee.error) throw employee.error;
  const profiles = await db.from('root_employee_profile_current').select('category,payload,source').eq('employee_id',employeeId);
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
  let current = options.currentRecord;
  if (!id && !current) {
    const kot = employee.data.kot_employee_id;
    if (!kot) throw new MissingRosterRecord('打刻IDがありません');
    const query = `打刻ID = "${String(kot).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}" order by 作成日時 desc limit 1`;
    const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/records.json?${new URLSearchParams({app,query,'fields[0]':'$id'})}`, {headers,cache:'no-store',signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`名簿検索失敗: ${response.status}`);
    id = (await response.json()).records?.[0]?.$id?.value;
    if (!id) throw new MissingRosterRecord('打刻IDが名簿にありません');
    if (!options.dryRun) {
      const saved = await db.from('root_employees').update({roster_record_id:id}).eq('employee_id',employeeId);
      if (saved.error) throw saved.error;
    }
  }
  if (!current) {
    const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/record.json?${new URLSearchParams({app,id:String(id)})}`, {headers,cache:'no-store',signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`名簿取得失敗: ${response.status}`);
    current = (await response.json()).record as RosterRecord;
  }
  const diff = diffRosterRecord(employee.data, mapped.record, current, profiles.data?.find(r => r.category === 'address')?.source, teams.data ?? [], profiles.data?.find(r => r.category === 'bank_account')?.source);
  const result = {held:false, changes:diff.changes, skipped:diff.skipped, errors:mapped.errors};
  if (options.dryRun || diff.changes.length === 0) return result;
  if (await getRosterDirection(db) !== 'garden_to_kintone') return {...result, held:true};
  const response = await fetchImpl(`https://${sub}.cybozu.com/k/v1/record.json`, {method:'PUT',headers,body:JSON.stringify({app,id,record:diff.record}),cache:'no-store',signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`名簿更新失敗: ${response.status}`);
  return result;
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
