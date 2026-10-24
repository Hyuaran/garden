import 'server-only';
import type { PoolClient } from 'pg';
import { withPgClient } from '@/lib/db/pg';
import { ChatworkClient } from '@/lib/chatwork';
import { applicant, type Applicant } from './model';
import { appliedAt, dateKey, identity, kintoneValues, optionalMappings, plan, type BaitoruSettings, type CsvRow, type Identity } from './baitoru';

export const BAITORU_LOCK = 42020261024; // Shared with the Kintone import.
type Stored = Applicant & { inquiry_no: string | null; source: string; mirror_record_id: string | null; is_repeat: boolean; notified_at: string | null; notify_error: string | null; imported_at: string | Date };
export async function settings(client: PoolClient) {
 const result=await client.query<BaitoruSettings>('select * from sprout_baitoru_settings where id=true');
 if(!result.rows[0]) throw new Error('取り込みの設定が見つかりません');
 return result.rows[0];
}
export function existingIdentity(a: Stored): Identity {
 const raw=a.raw || {}, text=(k:string)=>typeof raw[k]==='string' ? raw[k] as string : '';
 const field=process.env.KINTONE_FIELD_INQUIRY_NO || '問合せNo';
 const i=identity({'問合せNo':a.inquiry_no || text(field) || text('問合せNo'),'氏名（漢字）':a.name || a.last_name+a.first_name,'氏名（ふりがな）':a.kana || a.last_name_kana+a.first_name_kana,'電話番号':a.phone || '', 'メールアドレス（PC）':a.email || '',生年月日:a.birthday || '',応募日時:text('応募日時') || text(process.env.KINTONE_FIELD_APPLIED_AT || '文字列__1行__5')});
 i.applied=i.applied || (a.applied_date ? `${a.applied_date}T00:00:00+09:00` : '');
 const created=text('作成日時');
 i.created=created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : a.source==='baitoru' ? i.applied : new Date(a.imported_at).toISOString();
 return i;
}
function statusReason(error: unknown) {
 return error instanceof Error && /^(Kintone|通知|接続|取り込み)/.test(error.message) ? error.message.slice(0,180) : '接続または保存に失敗しました';
}
async function mirror(row: CsvRow) {
 const domain=process.env.KINTONE_SUBDOMAIN, token=process.env.KINTONE_RECRUIT_APPLICANTS_TOKEN;
 if(!domain || !/^[\w-]+$/.test(domain) || !token) throw new Error('Kintone の接続設定を確認してください');
 const values=kintoneValues(row);
 for(const [suffix,key] of Object.entries(optionalMappings)) {
  const field=process.env[`KINTONE_FIELD_${suffix}`]; if(field && row[key]) values[field]=row[key];
 }
 const response=await fetch(`https://${domain}.cybozu.com/k/v1/record.json`,{method:'POST',headers:{'X-Cybozu-API-Token':token,'Content-Type':'application/json'},body:JSON.stringify({app:44,record:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}),signal:AbortSignal.timeout(30000)});
 if(!response.ok) throw new Error(`Kintone の応答 ${response.status}`);
 const result=await response.json(); if(!/^\d+$/.test(String(result.id))) throw new Error('Kintone の登録番号を確認できません');
 return String(result.id);
}
export function notificationBody(a: Stored, s: BaitoruSettings) {
 const domain=process.env.KINTONE_SUBDOMAIN;
 const url=a.mirror_record_id && domain && /^[\w-]+$/.test(domain) ? `https://${domain}.cybozu.com/k/44/show#record=${a.mirror_record_id}` : `${(process.env.NEXT_PUBLIC_APP_URL || 'https://garden-os.net').replace(/\/$/,'')}/sprout`;
 // 宛先（TO）はコーポレートサイトの通知と同じく最後に 1 行（多数のときは名前なしの [To:id] を並べる・2026-10-24 東海林さん）
 const to = s.mentions.replace(/\s+/g, '');
 return `[info][title]${s.chatwork_title}[/title]\n${a.is_repeat?'※過去応募あり\n':''}応募日時: ${a.raw['応募日時'] || a.applied_date}\n氏名: ${a.name}${a.kana?`（${a.kana}）`:''}\n${url}\n[/info]${to?`\n${to}`:''}`;
}
async function notify(client: PoolClient, a: Stored, s: BaitoruSettings) {
 try {
  const room=s.notify_room==='production' ? process.env.SPROUT_BAITORU_CHATWORK_ROOM_ID || '365721933' : process.env.CHATWORK_DEV_ROOM_ID;
  const token=process.env.CHATWORK_API_TOKEN;
  if(!room || !token) throw new Error('通知先の設定を確認してください');
  await new ChatworkClient(token).sendMessage(room,notificationBody(a,s));
  await client.query('update sprout_applicants set notified_at=now(),notify_error=null where kintone_record_id=$1',[a.kintone_record_id]);
  return true;
 } catch(error) {
  await client.query('update sprout_applicants set notify_error=$2 where kintone_record_id=$1',[a.kintone_record_id,statusReason(error)]);
  return false;
 }
}
// 失敗の知らせの送り先：後確FC（応募の通知のルーム）には送らない。本番は Garden通知・重要通知、試しの間は開発ルーム（2026-10-24 東海林さん）
export function baitoruAlertRooms() {
 const rooms=(process.env.SPROUT_BAITORU_ALERT_ROOM_IDS || process.env.CHATWORK_DEV_ROOM_ID || '').split(',').map(r=>r.trim()).filter(r=>/^\d+$/.test(r));
 return [...new Set(rooms)];
}
export function baitoruAlertBody(failed: boolean, reason = '', now = new Date()) {
 const at=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 return failed
  ? `[info][title]バイトル応募の取り込みが止まっています[/title]${at}　${reason || '取り込みが続けて失敗しました'}\n新しい応募が Garden・Kintone・Chatwork に届いていない可能性があります。\n取り込みの記録：https://garden-os.net/sprout[/info]`
  : `[info][title]バイトル応募の取り込みが直りました[/title]${at}　取り込みが再開しました。[/info]`;
}
async function health(client: PoolClient, failed: boolean, reason = '') {
 const state=(await client.query<{consecutive_failures:number;failure_alerted:boolean}>('update sprout_baitoru_settings set consecutive_failures=case when $1 then consecutive_failures+1 else 0 end where id=true returning consecutive_failures,failure_alerted',[failed])).rows[0];
 if(!state || (failed ? state.consecutive_failures<3 || state.failure_alerted : !state.failure_alerted)) return;
 try {
  const client2=new ChatworkClient(process.env.CHATWORK_API_TOKEN || '');
  for (const room of baitoruAlertRooms()) await client2.sendMessage(room,baitoruAlertBody(failed,reason));
  await client.query('update sprout_baitoru_settings set failure_alerted=$1 where id=true',[failed]);
 } catch { /* Retry the notice on the next call, without failing the import. */ }
}
// ホスト PC が取りに行く前に聞く：止めている間はバイトルにログインしない（掲載しない間は止める運用・2026-10-24）
export async function baitoruEnabled() {
 return withPgClient(async client=>(await settings(client)).enabled);
}
export async function ingestBaitoru(rows: CsvRow[], dryRun=false) {
 return withPgClient(async client=>{
  const s=await settings(client);
  // 止めている間も「書き込みなしの試し」は判定まで行う（掲載前にホスト PC の取得と重複判定を確かめるため）
  if(!s.enabled && !dryRun) return {ok:true,skippedReason:'disabled'};
  const lock=await client.query('select pg_try_advisory_lock($1) as acquired',[BAITORU_LOCK]);
  if(!lock.rows[0].acquired) return {ok:true,skippedReason:'already syncing'};
  let run: string | undefined;
  const counts={totalRows:rows.length,added:0,notified:0,notifyFailed:0,repeatAdded:0};
  const errors:string[]=[];
  try {
   if(!dryRun) {
    await client.query('update sprout_baitoru_settings set last_called_at=now() where id=true');
    run=(await client.query('insert into sprout_baitoru_runs(dry_run) values(false) returning id')).rows[0].id;
   }
   const existing=(await client.query<Stored>('select * from sprout_applicants')).rows;
   const result=plan(rows,existing.map(existingIdentity),s,process.env.BAITORU_SEED_INQUIRY_NO || '238839645');
   if(dryRun) return {ok:true,dryRun:true,...result,counts};
   for(const item of result.selected) {
    const r=item.row, id=`baitoru:${r['問合せNo'].trim()}`, values=kintoneValues(r);
    const a=applicant(Object.fromEntries(Object.entries({...values,$id:id,従業員名_姓名:r['氏名（漢字）'],従業員名_姓名カナ:r['氏名（ふりがな）'] || '',チェックボックス_3:['バイトル']}).map(([k,value])=>[k,{value}])));
    a.raw={...a.raw,...r};
    // Commit the Garden copy before any external request; mirror failures cannot remove it.
    const columns=Object.keys(a);
    await client.query(`insert into sprout_applicants(${columns.join(',')},inquiry_no,source,is_repeat,notify_error) select ${columns.join(',')},$2,'baitoru',$3,'まだ知らせていません' from jsonb_populate_record(null::sprout_applicants,$1::jsonb)`,[JSON.stringify(a),r['問合せNo'].trim(),item.isRepeat]);
    counts.added++; if(item.isRepeat) counts.repeatAdded++;
    let mirrorId: string | null=null;
    try {
     mirrorId=await mirror(r);
     await client.query('update sprout_applicants set mirror_record_id=$2 where kintone_record_id=$1',[id,mirrorId]);
    } catch(error) { errors.push(`Kintone に登録できませんでした（${statusReason(error)}）`); }
    if(await notify(client,{...a,inquiry_no:r['問合せNo'],source:'baitoru',mirror_record_id:mirrorId,is_repeat:item.isRepeat,notified_at:null,notify_error:null,imported_at:new Date()},s)) counts.notified++; else counts.notifyFailed++;
   }
   const finalCounts={...counts,...result.filtered,trimmed:result.trimmed,newRows:result.selected.length};
   await client.query('update sprout_baitoru_runs set finished_at=now(),counts=$2,dedup_by_reason=$3,error=$4 where id=$1',[run,JSON.stringify(finalCounts),JSON.stringify(result.dedup),errors.join('\n') || null]);
   await health(client,false);
   return {ok:true,dryRun:false,counts:finalCounts,dedupByReason:result.dedup,errors};
  } catch(error) {
   if(!dryRun) {
    if(run) await client.query('update sprout_baitoru_runs set finished_at=now(),counts=$2,error=$3 where id=$1',[run,JSON.stringify(counts),statusReason(error)]);
    await health(client,true,'Garden で応募を登録できませんでした');
   }
   throw new Error('取り込みに失敗しました。取り込みの記録を確認してください');
  } finally { await client.query('select pg_advisory_unlock($1)',[BAITORU_LOCK]); }
 });
}
export async function resendBaitoru(id: string) {
 return withPgClient(async client=>{
  const lock=await client.query('select pg_try_advisory_lock($1) as acquired',[BAITORU_LOCK]);
  if(!lock.rows[0].acquired) return {ok:false};
  try {
   const a=(await client.query<Stored>("select * from sprout_applicants where kintone_record_id=$1 and source='baitoru' and notified_at is null and notify_error is not null",[id])).rows[0];
   if(!a) return {ok:false};
   return {ok:await notify(client,a,await settings(client))};
  } finally {await client.query('select pg_advisory_unlock($1)',[BAITORU_LOCK]);}
 });
}

// ホスト PC から来る失敗理由は「Baitoru agent failed (段階)」の形。段階だけを読み、決まった日本語にする（来た文はそのまま残さない）
const FAILURE_REASONS: Record<string,string> = {
 lock: 'ホスト PC で前回の取り込みが終わっていません',
 browser: 'ホスト PC でブラウザを起動できませんでした',
 download: 'バイトルにログインできないか、応募の一覧を取り出せませんでした',
 'browser-close': 'ホスト PC でブラウザを閉じられませんでした',
 send: 'ホスト PC から Garden へ送れませんでした',
};
export function baitoruFailureReason(error?: string) {
 const stage = /\(([a-z-]+)\)\s*$/.exec(error ?? '')?.[1] ?? '';
 return FAILURE_REASONS[stage] ?? 'ホスト PC での取り込みが失敗しました';
}
// Never persist caller text: it may contain credentials or applicant data.
export async function reportBaitoruFailure(error?: string) {
 return withPgClient(async client=>{
  if(!(await settings(client)).enabled) return {ok:true,skippedReason:'disabled'};
  const lock=await client.query('select pg_try_advisory_lock($1) as acquired',[BAITORU_LOCK]);
  if(!lock.rows[0].acquired) return {ok:true,skippedReason:'already syncing'};
  try {
   await client.query('update sprout_baitoru_settings set last_called_at=now() where id=true');
   const reason=baitoruFailureReason(error);
   await client.query("insert into sprout_baitoru_runs(dry_run,finished_at,error) values(false,now(),$1)",[reason]);
   await health(client,true,reason);
   return {ok:true};
  } finally {await client.query('select pg_advisory_unlock($1)',[BAITORU_LOCK]);}
 });
}
