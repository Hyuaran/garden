import { pathToFileURL } from 'node:url';

const teams = ['宮永チーム','小泉チーム','石原チーム','新人チーム','バックヤード','所属なし'];
const businesses = ['ブロードバンド事業','NHK派遣事業','関西電力事業'];
const value = (record, key) => record[key]?.value;
const normalizeId = id => String(id ?? '').trim().replace(/^0+(?=\d)/,'');
export function normalizeTeam(team, employment) {
  if (team === 'ヒュアラングループ') return employment === 'アルバイト' ? '新人チーム' : '所属なし';
  return teams.includes(team) ? team : '所属なし';
}
export function currentTeam(rows, date) {
  return rows.filter(r=>r.effective_date<=date).sort((a,b)=>b.effective_date.localeCompare(a.effective_date)||b.entered_at.localeCompare(a.entered_at)||String(b.id||b.source_ref).localeCompare(String(a.id||a.source_ref)))[0]?.team ?? null;
}
export function planImport(records, employees, existing, tags, members) {
  const byKot=new Map();
  for(const e of employees) {
    // 削除済みの行（古い仮登録など）は突き合わせに使わない
    if(e.deleted_at)continue;
    const key=normalizeId(e.kot_employee_id);if(!key)continue;
    if(byKot.has(key))throw new Error('Root の打刻 ID が重複しています。取り込みを中止しました。');
    byKot.set(key,e);
  }
  const refs=new Set(existing.map(r=>r.source_ref).filter(Boolean)), inserts=[], updates=[], corrected=[];
  let skipped=0;
  for(const record of records) {
    const e=byKot.get(normalizeId(value(record,'打刻ID')));if(!e){skipped++;continue;}
    for(const row of value(record,'テーブル')||[]) {
      const r=row.value, date=value(r,'日付_8');
      const ref=`kintone:${value(record,'$id')}:${row.id}`;
      if(refs.has(ref))continue;
      if(!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) {skipped++;continue;}
      const at=value(r,'日時');
      inserts.push({employee_id:e.employee_id,effective_date:date,team:normalizeTeam(value(r,'ドロップダウン_17'),value(record,'雇用形態')||e.employment_type),memo:value(r,'文字列__複数行_')||null,entered_by:'kintone',entered_at:at&&!Number.isNaN(Date.parse(at))?new Date(at).toISOString():`${date}T00:00:00+09:00`,source:'kintone',source_ref:ref});refs.add(ref);
    }
  }
  for(const e of employees) {
    const own=tags.filter(t=>members.some(m=>m.source==='manual'&&m.employee_id===e.employee_id&&m.tag_id===t.id));
    const bs=own.filter(t=>t.kind==='business'), ts=own.filter(t=>t.kind==='team');
    if(bs.length>1 || ts.length>1)throw new Error('事業またはチームのタグが複数あります。取り込みを中止しました。');
    if(bs[0]&&!businesses.includes(bs[0].name))throw new Error('未対応の事業タグがあります。');
    if(bs[0]&&e.business!==bs[0].name)updates.push({employee_id:e.employee_id,business:bs[0].name});
    const ref=`line-confirmed:2026-10-29:${e.employee_id}`;
    if(ts[0]&&!teams.includes(ts[0].name))throw new Error('未対応のチームタグがあります。');
    if(ts[0]&&!refs.has(ref)&&currentTeam([...existing,...inserts].filter(r=>r.employee_id===e.employee_id),'2026-10-29')!==ts[0].name) {
      inserts.push({employee_id:e.employee_id,effective_date:'2026-10-29',team:ts[0].name,memo:'公式 LINE のチーム（営業の確認）に合わせた',entered_by:'garden',entered_at:'2026-10-29T23:59:59+09:00',source:'garden',source_ref:ref});refs.add(ref);corrected.push({number:e.employee_number,name:e.name});
    }
  }
  return {inserts,updates,corrected,skipped};
}
function checked(result) {if(result.error)throw new Error(result.error.message);return result.data;}
export async function main(args=process.argv.slice(2)) {
  if(args.some(a=>a!=='--dry-run'))throw new Error('使用方法: node scripts/import-team-history.mjs [--dry-run]');
  const dryRun=args.includes('--dry-run');
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','KINTONE_SUBDOMAIN','KINTONE_EMPLOYEE_ROSTER_TOKEN'])if(!process.env[key])throw new Error(`${key} が必要です。`);
  const {createClient}=await import('@supabase/supabase-js');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  async function rows(table,select='*',order='id') {
    const all=[];for(let offset=0;;offset+=1000){const page=checked(await db.from(table).select(select).order(order).range(offset,offset+999));all.push(...page);if(page.length<1000)return all;}
  }
  const records=[];let last='0';
  for(;;) {
    const url=new URL(`https://${process.env.KINTONE_SUBDOMAIN}.cybozu.com/k/v1/records.json`);
    url.searchParams.set('app','56');url.searchParams.set('query',`$id > ${last} order by $id asc limit 500`);
    ['$id','打刻ID','雇用形態','テーブル'].forEach((f,i)=>url.searchParams.set(`fields[${i}]`,f));
    const response=await fetch(url,{headers:{'X-Cybozu-API-Token':process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN}});
    if(!response.ok)throw new Error(`Kintone の読み込みに失敗しました (${response.status})`);
    const page=(await response.json()).records;records.push(...page);if(page.length<500)break;last=value(page.at(-1),'$id');
  }
  const [employees,existing,tags,members]=await Promise.all([rows('root_employees','employee_id,employee_number,name,kot_employee_id,employment_type,business,deleted_at','employee_id'),rows('root_employee_team_history'),rows('system_line_tag'),rows('system_line_tag_member','*','employee_id')]);
  const plan=planImport(records,employees,existing,tags,members);
  if(!dryRun) {
    for(const update of plan.updates)checked(await db.from('root_employees').update({business:update.business}).eq('employee_id',update.employee_id));
    for(let i=0;i<plan.inserts.length;i+=500)checked(await db.from('root_employee_team_history').upsert(plan.inserts.slice(i,i+500),{onConflict:'source_ref',ignoreDuplicates:true}));
    checked(await db.from('root_team_import_state').update({ready:true}).eq('id',true));
  }
  console.log(JSON.stringify({dryRun,imported:plan.inserts.length,businessUpdated:plan.updates.length,correctedCount:plan.corrected.length,corrected:plan.corrected,skipped:plan.skipped},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
