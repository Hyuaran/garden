import { beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapEmployeeToRosterRecord, queueRosterPush, retryRosterPushes, pushEmployeeToRoster } from './roster-push.server';
import { mapRosterRecordToProfilePayloads, mapRosterRecordToRoot, writeRetirementToRoster } from './roster-sync.server';
import { mergeProfileChanges, saveProfileChanges, validProfileChanges } from './roster-profile-edit.server';
import { ROSTER_FIELDS } from './roster-fields';
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:()=>db}));
let direction = 'kintone_to_garden';
let queue: Record<string,unknown>[];
let history: Record<string,unknown>[];
let employee: Record<string,unknown>;
let profiles: Record<string,unknown>[];
const db = {
  rpc: vi.fn(async (_name:string,args:Record<string,unknown>)=>{
    if (_name === 'root_claim_roster_push') return {data:true};
    let row = queue.find(r=>r.employee_id === args.p_employee_id && ['pending','held'].includes(String(r.status)));
    if (!row) {row={id:'q',employee_id:args.p_employee_id};queue.push(row);}
    Object.assign(row,{status:args.p_status,reason:args.p_reason,attempts:0,requested_at:'now'});
    return {data:row.id};
  }),
  from(table:string) {
    const filters: ((r:Record<string,unknown>)=>boolean)[]=[];
    let update: Record<string,unknown>|undefined;
    const q = {
      select:()=>q, order:()=>q, limit:()=>q,
      eq:(key:string,value:unknown)=>{filters.push(r=>r[key]===value);return q;},
      in:(key:string,values:unknown[])=>{filters.push(r=>values.includes(r[key]));return q;},
      update:(value:Record<string,unknown>)=>{update=value;return q;},
      insert:async (value:Record<string,unknown>)=>{history.push(value);return {};},
      single:async()=>({data:(await q)[0]}),
      maybeSingle:async()=>({data:(await q)[0]}),
      then(resolve:(v:Record<string,unknown>[])=>unknown) {
        const rows = table === 'root_roster_settings' ? [{id:true,direction}] : table === 'root_employees' ? [employee] : table === 'root_employee_profile_current' ? profiles : table === 'root_roster_push_queue' ? queue : [];
        const selected = rows.filter(r=>filters.every(f=>f(r)));
        if(update) selected.forEach(r=>Object.assign(r,update));
        // Supabase's query thenable returns an object, unlike internal single helpers.
        return Promise.resolve(resolve(selected));
      },
    };
    // Return {data,error} to await while retaining convenient terminal methods.
    const result = new Proxy(q,{get(target,key){
      if(key==='then') return (resolve:(v:unknown)=>unknown)=>q.then(rows=>resolve({data:rows}));
      if(key==='single' || key==='maybeSingle') return async()=>{let data:unknown;await q.then(rows=>{data=rows[0] ?? null;});return {data};};
      const value=target[key as keyof typeof target];
      return typeof value==='function' ? (...args:unknown[])=>{const v=(value as (...a:unknown[])=>unknown)(...args);return v===q ? result:v;} : value;
    }});
    return result;
  },
};
const options = () => ({supabase:db as unknown as SupabaseClient,fetchImpl:fetchMock as unknown as typeof fetch});
const fetchMock = vi.fn();
beforeEach(()=>{
  direction='kintone_to_garden';queue=[];history=[];profiles=[];
  employee={employee_id:'EMP-1',name:'山田 太郎',employment_type:'正社員',is_active:true,roster_record_id:'12'};
  fetchMock.mockReset().mockResolvedValue({ok:true});db.rpc.mockClear();
  vi.stubEnv('KINTONE_SUBDOMAIN','test');vi.stubEnv('KINTONE_EMPLOYEE_ROSTER_TOKEN','mock');
});
it('round trips every imported writable profile field and excludes protected fields',()=>{
  const source:Record<string,{value:unknown}>={};
  for(const fields of Object.values(ROSTER_FIELDS)) for(const code of Object.values(fields)) source[code]={value:'123'};
  Object.assign(source,{'$id':{value:'12'},打刻ID:{value:'0001'},従業員名_姓名:{value:'山田 太郎'},従業員名_姓名カナ:{value:'ヤマダ タロウ'},雇用形態:{value:'正社員'},従業員ステータス:{value:'在籍中'},生年月日:{value:'1990-01-01'},入社日:{value:'2020-01-01'},退職日:{value:''},ドロップダウン:{value:'SES'},ドロップダウン_0:{value:'営業1部'},ドロップダウン_15:{value:'ヒュアラン'},ドロップダウン_1:{value:'あり'},ドロップダウン_3:{value:'本町'},ドロップダウン_4:{value:'加入中'},ドロップダウン_5:{value:'扶養'},ドロップダウン_6:{value:'不要'},ドロップダウン_8:{value:'する'},ドロップダウン_16:{value:'トス'},銀行名_1:{value:'楽天銀行'},種別:{value:'普通'},種別_1:{value:'当座'}});
  const payloads=Object.fromEntries(mapRosterRecordToProfilePayloads(source,'2026-10-29').map(r=>[r.category,r.payload]));
  const mapped=mapEmployeeToRosterRecord(mapRosterRecordToRoot(source),payloads);
  expect(mapped.errors).toEqual([]);
  for(const fields of Object.values(ROSTER_FIELDS)) for(const code of Object.values(fields)) {
    if(['交通費_往復','配属・異動_1','チーム名'].includes(code)) continue;
    expect(String(mapped.record[code]?.value),code).toBe(String(source[code].value));
  }
  for(const code of ['マイナンバー','社員番号','交通費_往復','配属・異動_1','東海林メモ']) expect(mapped.record).not.toHaveProperty(code);
});
it('skips unsupported choices and maps outsource and full team history',()=>{
  const mapped=mapEmployeeToRosterRecord({...employee,employment_type:'outsource'},{employment:{business:'別事業'},bank_account:{bank_name:'他行'}},[{id:'1',employee_id:'EMP-1',team:'新人チーム',effective_date:'2020-01-01',entered_at:'2020-01-01',entered_by:'x',source:'garden',memo:'移動'}]);
  expect(mapped.record.雇用形態.value).toBe('パートナー');expect(mapped.record.チーム名.value).toBe('ヒュアラングループ');expect(mapped.record.テーブル.value).toHaveLength(1);
  expect(mapped.record).not.toHaveProperty('ドロップダウン');expect(mapped.errors).toHaveLength(2);
});
it('holds and deduplicates without any external writes',async()=>{
  await queueRosterPush('EMP-1','root_edit',options());await queueRosterPush('EMP-1','team',options());
  expect(queue).toHaveLength(1);expect(queue[0].status).toBe('held');expect(fetchMock).not.toHaveBeenCalled();
  expect(await pushEmployeeToRoster('EMP-1',options())).toMatchObject({held:true});
});
it('sends held rows after switching and records invalid choices',async()=>{
  await queueRosterPush('EMP-1','root_edit',options());direction='garden_to_kintone';profiles=[{employee_id:'EMP-1',category:'employment',payload:{business:'bad'}}];
  await retryRosterPushes(options());expect(queue[0].status).toBe('done');expect(queue[0].last_error).toContain('Kintone');
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBe('12');
});
it('keeps failures pending and stops after five attempts',async()=>{
  direction='garden_to_kintone';fetchMock.mockResolvedValue({ok:false,status:503});
  expect(await queueRosterPush('EMP-1','root_edit',options())).toHaveProperty('warning');
  for(let i=0;i<4;i++) await retryRosterPushes(options());
  expect(queue[0]).toMatchObject({status:'failed',attempts:5});await retryRosterPushes(options());expect(fetchMock).toHaveBeenCalledTimes(5);
});
it('fails permanently when a KOT search finds no roster record',async()=>{
  direction='garden_to_kintone';employee.roster_record_id=null;employee.kot_employee_id='0001';fetchMock.mockResolvedValue({ok:true,json:async()=>({records:[]})});
  await queueRosterPush('EMP-1','root_edit',options());expect(queue[0].status).toBe('failed');expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('stores a found roster ID before updating that record',async()=>{
  direction='garden_to_kintone';employee.roster_record_id=null;employee.kot_employee_id='0001';
  fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({records:[{$id:{value:'99'}}]})}).mockImplementationOnce(async()=>{
    expect(employee.roster_record_id).toBe('99');return {ok:true};
  });
  await queueRosterPush('EMP-1','root_edit',options());
  expect(fetchMock).toHaveBeenCalledTimes(2);expect(queue[0].status).toBe('done');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).id).toBe('99');
});
it('defers a second sender when the same employee already has a lease',async()=>{
  direction='garden_to_kintone';
  db.rpc.mockImplementationOnce(async()=>{queue.push({id:'q',employee_id:'EMP-1',status:'pending',attempts:0,requested_at:'now'});return {data:'q'};})
    .mockImplementationOnce(async()=>({data:false}));
  expect(await queueRosterPush('EMP-1','team',options())).toHaveProperty('warning');
  expect(fetchMock).not.toHaveBeenCalled();expect(queue[0].status).toBe('pending');
});
it('before switching, retirement keeps the legacy direct write instead of queueing',async()=>{
  const result=await writeRetirementToRoster({employee_id:'EMP-1',termination_date:'2020-01-01'},fetchMock as unknown as typeof fetch);
  expect(result.status).toBe('skipped');expect(queue).toHaveLength(0);expect(fetchMock).not.toHaveBeenCalled();
});
it('merges only changed categories, preserving unknown and nested fields',async()=>{
  profiles=[{employee_id:'EMP-1',category:'address',payload:{city:'大阪市',room:'1'}},{employee_id:'EMP-1',category:'contact',payload:{phone:'123'}}];
  await saveProfileChanges(db as unknown as SupabaseClient,'EMP-1',{address:{room:'2'},contact:{phone:'123'}},'admin');
  expect(history).toHaveLength(1);expect(history[0]).toMatchObject({source:'admin',recorded_by:'admin',payload:{city:'大阪市',room:'2'}});
  expect(mergeProfileChanges({sub_account:{bank_name:'楽天銀行',branch_code:'123'}},{sub_account:{branch_code:'456'}})).toEqual({sub_account:{bank_name:'楽天銀行',branch_code:'456'}});
  expect(validProfileChanges({employment:{salary_system:'forbidden'}})).toBe(false);
});
