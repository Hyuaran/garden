// Run with an existing TypeScript runner and the usual environment variables.
// Read only: Kintone batches of 500; no queue, DB updates, or PUT requests.
import { writeFile } from 'node:fs/promises';
import { getSupabaseAdmin } from '../src/lib/supabase/admin';
import { pushEmployeeToRoster, type RosterRecord } from '../src/app/root/_lib/roster-push.server';

const mask = (code: string, value: unknown): unknown => /口座番号|マイナンバー/.test(code)
  ? `****${String(value ?? '').slice(-4)}` : value;
async function main() {
  const db = getSupabaseAdmin();
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || '56';
  const sub = process.env.KINTONE_SUBDOMAIN;
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN;
  if (!sub || !token) throw new Error('Kintone環境変数未設定');
  const byId = new Map<string, RosterRecord>();
  const byKot = new Map<string, RosterRecord>();
  let last = '0';
  while (true) {
    const params = new URLSearchParams({app, query:`$id > ${last} order by $id asc limit 500`});
    const response = await fetch(`https://${sub}.cybozu.com/k/v1/records.json?${params}`, {
      headers:{'X-Cybozu-API-Token':token}, signal:AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`名簿取得失敗: ${response.status}`);
    const records = (await response.json()).records as RosterRecord[];
    for (const record of records) {
      byId.set(String(record.$id.value), record);
      byKot.set(String(record.打刻ID?.value ?? ''), record);
    }
    if (records.length < 500) break;
    last = String(records.at(-1)!.$id.value);
  }
  const counts: Record<string, number> = {};
  const people = [];
  for (let offset = 0; ; offset += 500) {
    const {data, error} = await db.from('root_employees').select('employee_id,employee_number,roster_record_id,kot_employee_id')
      .order('employee_id').range(offset, offset + 499);
    if (error) throw error;
    for (const employee of data ?? []) {
      if (!employee.roster_record_id && !employee.kot_employee_id) continue;
      const currentRecord = employee.roster_record_id ? byId.get(String(employee.roster_record_id)) : byKot.get(String(employee.kot_employee_id));
      if (!currentRecord) {
        people.push({employeeNumber:employee.employee_number, changes:[], errors:['名簿に該当レコードがありません']});
        continue;
      }
      let result;
      try { result = await pushEmployeeToRoster(employee.employee_id, {supabase:db, dryRun:true, currentRecord}); }
      catch (error) { people.push({employeeNumber:employee.employee_number, changes:[], errors:[error instanceof Error ? error.message : String(error)]}); continue; }
      const changes = result.changes.map(({code, from, to}) => ({code, from:mask(code, from), to:mask(code, to)}));
      for (const change of changes) counts[change.code] = (counts[change.code] ?? 0) + 1;
      people.push({employeeNumber:employee.employee_number, changes, skipped:result.skipped, errors:result.errors});
    }
    if (!data || data.length < 500) break;
  }
  const report = {counts, people};
  console.log(JSON.stringify(report, null, 2));
  const json = process.argv.indexOf('--json');
  if (json >= 0) await writeFile(process.argv[json + 1] || 'roster-push-diff.json', JSON.stringify(report, null, 2), 'utf8');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
