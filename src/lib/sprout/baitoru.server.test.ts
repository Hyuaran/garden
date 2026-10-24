import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({query:vi.fn(),postings:vi.fn(),fetch:vi.fn(),send:vi.fn(),access:vi.fn()}));
vi.mock('@/lib/db/pg',()=>({withPgClient:(fn:(c:unknown)=>unknown)=>fn({query:(sql:string,...args:unknown[])=>sql.includes('from sprout_baitoru_postings')?m.postings():m.query(sql,...args)}),queryPg:(...args:unknown[])=>m.query(...args)}));
vi.mock('@/lib/chatwork',()=>({ChatworkClient:class {sendMessage(...args:unknown[]){return m.send(...args);}}}));
vi.mock('./access.server',()=>({requireSproutUser:m.access}));
import {baitoruEnabled,reportBaitoruFailure,ingestBaitoru,resendBaitoru,notificationBody,existingIdentity,baitoruFailureReason,baitoruAlertBody,baitoruAlertRooms} from './baitoru.server';
process.env.CHATWORK_DEV_ROOM_ID ||= '433894375';
import {loadBaitoru,saveBaitoru,retryBaitoru} from '@/app/sprout/postings/baitoru-actions';
import {applicant} from './model';
import type {BaitoruSettings,CsvRow} from './baitoru';
const config:BaitoruSettings={enabled:true,period_start:'2026-09-22',chatwork_title:'【バイトル新規応募】',exclude_inquiry_nos:[],notify_room:'dev',mentions:'[To:1]',max_per_run:10};
const row:CsvRow={'問合せNo':'238839646','応募日時':'2026/10/24 10:12:00','氏名（漢字）':'山田 花子','氏名（ふりがな）':'やまだ はなこ','メールアドレス（PC）':'a@example.com','電話番号':'090-1234-5678'};
const stored={...applicant({$id:{value:'baitoru:238839646'},従業員名_姓名:{value:'山田 花子'}}),raw:{...row},inquiry_no:row['問合せNo'],source:'baitoru',mirror_record_id:null,is_repeat:true,notified_at:null,notify_error:'失敗',imported_at:new Date()};
beforeEach(()=>{
 vi.resetAllMocks();vi.stubGlobal('fetch',m.fetch);
 m.postings.mockResolvedValue({rows:[{id:'p',start_date:'2026-09-22',end_date:'2099-12-31',content:'テレマアルバイト',ended_early_at:null}]});
 vi.stubEnv('KINTONE_SUBDOMAIN','example');vi.stubEnv('KINTONE_RECRUIT_APPLICANTS_TOKEN','readonly');vi.stubEnv('CHATWORK_API_TOKEN','automatic');vi.stubEnv('CHATWORK_DEV_ROOM_ID','433894375');
 m.access.mockResolvedValue({id:'admin'});m.send.mockResolvedValue({message_id:'1'});
 m.fetch.mockResolvedValue({ok:false,status:403});
 m.query.mockImplementation(async(sql:string)=>({rows:sql==='select * from sprout_baitoru_settings where id=true'?[config]:sql.includes('as acquired')?[{acquired:true}]:sql.includes('returning id')?[{id:'1'}]:sql.includes('consecutive_failures,failure_alerted')?[{consecutive_failures:0,failure_alerted:false}]:[]}));
});
it('disabled has no writes, lock or external requests',async()=>{
 m.postings.mockResolvedValue({rows:[]});
 m.query.mockResolvedValue({rows:[{...config,enabled:false}]});
 expect(await ingestBaitoru([row])).toEqual({ok:true,skippedReason:'disabled'});expect(m.query).toHaveBeenCalledTimes(1);expect(m.fetch).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});
it('uses postings instead of the legacy enabled switch',async()=>{
 m.query.mockResolvedValue({rows:[{...config,enabled:false}]});
 expect(await baitoruEnabled()).toBe(true);
 m.query.mockResolvedValue({rows:[{...config,enabled:true}]});m.postings.mockResolvedValue({rows:[]});
 expect(await baitoruEnabled()).toBe(false);
});
it('dryRun still returns decisions while disabled, without writes',async()=>{
 m.postings.mockResolvedValue({rows:[{id:'old',start_date:'2026-09-22',end_date:'2026-10-05',content:'テレマアルバイト',ended_early_at:null}]});
 m.query.mockImplementation(async(sql:string)=>({rows:sql==='select * from sprout_baitoru_settings where id=true'?[{...config,enabled:false}]:sql.includes('as acquired')?[{acquired:true}]:[]}));
 const r=await ingestBaitoru([row],true);expect(r).toMatchObject({ok:true,dryRun:true,selected:[{row,isRepeat:false}]});
 expect(m.query.mock.calls.every(([sql])=>sql.startsWith('select'))).toBe(true);expect(m.fetch).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});
it('dryRun returns decisions without any writes, including heartbeat, history or notices',async()=>{
 const r=await ingestBaitoru([row],true);expect(r).toMatchObject({ok:true,dryRun:true,selected:[{row,isRepeat:false}]});
 expect(m.query.mock.calls.every(([sql])=>sql.startsWith('select'))).toBe(true);expect(m.fetch).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});
it('keeps Sprout on Kintone 403, logs the reason, and uses Garden notification link',async()=>{
 expect(await ingestBaitoru([row])).toMatchObject({ok:true,counts:{added:1,notified:1},errors:[expect.stringContaining('403')]});
 const calls=m.query.mock.calls;
 expect(calls.some(([sql])=>sql.startsWith('insert into sprout_applicants'))).toBe(true);
 expect(calls.some(([sql])=>sql.includes('last_called_at=now()'))).toBe(true);
 expect(calls.some(([sql])=>/delete|rollback/.test(sql))).toBe(false);
 expect(m.send.mock.calls[0][0]).toBe('433894375');expect(m.send.mock.calls[0][1]).toContain('/sprout');
 expect(m.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(m.query.mock.invocationCallOrder[calls.findIndex(([sql])=>sql.startsWith('insert into sprout_applicants'))]);
});
it('uses the returned mirror ID, required fields, and configured optional fields',async()=>{
 vi.stubEnv('KINTONE_FIELD_INQUIRY_NO','問合せ番号');
 m.fetch.mockResolvedValue({ok:true,json:async()=>({id:'42'})});
 await ingestBaitoru([row]);
 const payload=JSON.parse(m.fetch.mock.calls[0][1].body);expect(payload).toMatchObject({app:44,record:{従業員名_姓:{value:'山田'},問合せ番号:{value:'238839646'}}});
 expect(m.send.mock.calls[0][1]).toContain('https://example.cybozu.com/k/44/show#record=42');
});
it('refuses overlap, and releases the shared lock on failures',async()=>{
 m.query.mockImplementationOnce(async()=>({rows:[config]})).mockImplementationOnce(async()=>({rows:[{acquired:false}]}));
 expect(await ingestBaitoru([row])).toMatchObject({skippedReason:'already syncing'});expect(m.fetch).not.toHaveBeenCalled();
 m.query.mockImplementation(async(sql:string)=>{
  if(sql==='select * from sprout_applicants')throw new Error('database');
  return {rows:sql.includes('settings where')?[config]:sql.includes('as acquired')?[{acquired:true}]:sql.includes('returning id')?[{id:'1'}]:[]};
 });
 await expect(ingestBaitoru([row])).rejects.toThrow('取り込みに失敗');
 expect(m.query.mock.calls.at(-1)?.[0]).toContain('pg_advisory_unlock');
});
it('records notification failure and retries only unsent failures, once',async()=>{
 m.send.mockRejectedValueOnce(new Error('通知に失敗しました'));
 expect(await ingestBaitoru([row])).toMatchObject({counts:{notifyFailed:1}});
 expect(m.query.mock.calls.some(([sql])=>sql.includes('set notify_error=$2'))).toBe(true);
 let sent=false;
 m.query.mockImplementation(async(sql:string)=>{
  if(sql.includes("and notified_at is null"))return {rows:sent?[]:[stored]};
  if(sql.includes('notified_at=now()'))sent=true;
  return {rows:sql.includes('as acquired')?[{acquired:true}]:sql.includes('settings where')?[config]:[]};
 });
 expect(await resendBaitoru(stored.kintone_record_id)).toEqual({ok:true});expect(await resendBaitoru(stored.kintone_record_id)).toEqual({ok:false});
 expect(m.send).toHaveBeenCalledTimes(2);expect(m.send.mock.calls[1][1]).toContain('※過去応募あり');
});
it('sends one notice after three failures and one on recovery',async()=>{
 let failures=0,alerted=false,fail=true;
 m.query.mockImplementation(async(sql:string,params:unknown[]=[])=>{
  if(sql==='select * from sprout_applicants' && fail) throw new Error('db');
  if(sql.includes('consecutive_failures=case')) {failures=params[0]?failures+1:0;return {rows:[{consecutive_failures:failures,failure_alerted:alerted}]};}
  if(sql.includes('set failure_alerted=$1'))alerted=params[0] as boolean;
  return {rows:sql.includes('settings where')?[config]:sql.includes('as acquired')?[{acquired:true}]:sql.includes('returning id')?[{id:'1'}]:[]};
 });
 for(let i=0;i<4;i++)await expect(ingestBaitoru([])).rejects.toThrow();
 expect(m.send).toHaveBeenCalledTimes(1);fail=false;await ingestBaitoru([]);await ingestBaitoru([]);expect(m.send).toHaveBeenCalledTimes(2);expect(m.send.mock.calls[1][1]).toContain('直りました');
});
it('guards settings, history, save and resend with super-admin access',async()=>{
 m.access.mockRejectedValue(new Error('閲覧権限がありません'));
 await expect(loadBaitoru()).rejects.toThrow('閲覧権限');await expect(saveBaitoru(config)).rejects.toThrow('閲覧権限');await expect(retryBaitoru('id')).rejects.toThrow('閲覧権限');expect(m.query).not.toHaveBeenCalled();
});
it('rejects invalid settings before updates and preserves mirror metadata in dedup identities',async()=>{
 await expect(saveBaitoru({...config,max_per_run:0})).rejects.toThrow('設定');expect(m.query).not.toHaveBeenCalled();
 expect(existingIdentity({...stored,source:'kintone',inquiry_no:null,raw:{問合せ番号:'99',作成日時:'2026-10-23T01:00:00Z'}}).created).toBe('2026-10-23T01:00:00.000Z');
 expect(notificationBody({...stored,mirror_record_id:'1'},config)).toContain('record=1');
});
it('puts the To line at the end of the notification on one line',()=>{
 const body=notificationBody({...stored,mirror_record_id:'1'},{...config,mentions:'[To:2746758]\n[To:4958142]'});
 expect(body.startsWith('[info][title]')).toBe(true);
 expect(body.endsWith('[/info]\n[To:2746758][To:4958142]')).toBe(true);
});

it('records host failure and increments health without importing applicants',async()=>{
 expect(await reportBaitoruFailure()).toEqual({ok:true});
 expect(m.query.mock.calls.some(([sql,args])=>sql.includes('consecutive_failures=case') && args[0]===true)).toBe(true);
 expect(m.query.mock.calls.some(([sql])=>sql.startsWith('insert into sprout_baitoru_runs'))).toBe(true);
 expect(m.fetch).not.toHaveBeenCalled();expect(m.query.mock.calls.at(-1)?.[0]).toContain('pg_advisory_unlock');
});
it('turns the host failure stage into short Japanese and never echoes the raw text',()=>{
 expect(baitoruFailureReason('Baitoru agent failed (download)')).toBe('バイトルにログインできないか、応募の一覧を取り出せませんでした');
 expect(baitoruFailureReason('password=abc (unknown)')).toBe('ホスト PC での取り込みが失敗しました');
 const body=baitoruAlertBody(true,'ホスト PC でブラウザを起動できませんでした',new Date('2026-10-24T03:00:00Z'));
 expect(body).toContain('バイトル応募の取り込みが止まっています');expect(body).toContain('10/24 12:00');expect(body).not.toContain('Error');
});
it('sends failure notices to the alert rooms only (dev room until switched)',()=>{
 const before={...process.env};process.env.SPROUT_BAITORU_ALERT_ROOM_IDS='';process.env.CHATWORK_DEV_ROOM_ID='433894375';
 expect(baitoruAlertRooms()).toEqual(['433894375']);
 process.env.SPROUT_BAITORU_ALERT_ROOM_IDS='450125458, 451292009';expect(baitoruAlertRooms()).toEqual(['450125458','451292009']);
 process.env=before;
});
