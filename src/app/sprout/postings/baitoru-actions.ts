"use server";
import { requireSproutUser } from '@/lib/sprout/access.server';
import { queryPg } from '@/lib/db/pg';
import { resendBaitoru } from '@/lib/sprout/baitoru.server';
import type { BaitoruSettings } from '@/lib/sprout/baitoru';
import { todayJst, yesterdayJst, validPosting, type Posting } from '@/lib/sprout/postings';
export async function loadBaitoru() {
 await requireSproutUser();
 const [settings,runs,failed,postings]=await Promise.all([
  queryPg<BaitoruSettings & {last_called_at:string|null;content_options:string[]}>('select * from sprout_baitoru_settings where id=true',[]),
  queryPg<{id:string;started_at:string;counts:Record<string,number>;dedup_by_reason:Record<string,number>;error:string|null}>('select * from sprout_baitoru_runs order by id desc limit 50',[]),
  queryPg<{kintone_record_id:string;name:string;notify_error:string}>("select kintone_record_id,name,notify_error from sprout_applicants where source='baitoru' and notified_at is null and notify_error is not null order by applied_date",[]),
  queryPg<Posting>('select id,start_date::text,end_date::text,content,created_at,ended_early_at from sprout_baitoru_postings order by created_at desc,id desc',[]),
 ]);
 return JSON.parse(JSON.stringify({settings:settings.rows[0],runs:runs.rows,failed:failed.rows,postings:postings.rows,today:todayJst()})) as {settings:BaitoruSettings & {last_called_at:string|null;content_options:string[]};runs:typeof runs.rows;failed:typeof failed.rows;postings:Posting[];today:string};
}
export async function saveBaitoru(s: BaitoruSettings) {
 const user=await requireSproutUser();
 if(!['dev','production'].includes(s.notify_room) || !Number.isInteger(s.max_per_run) || s.max_per_run<1 || s.max_per_run>100 || typeof s.mentions!=='string' || s.mentions.length>10000 || !Array.isArray(s.exclude_inquiry_nos) || s.exclude_inquiry_nos.some(n=>typeof n!=='string' || !/^\d+$/.test(n))) throw new Error('設定の内容を確認してください');
 await queryPg('update sprout_baitoru_settings set exclude_inquiry_nos=$1,notify_room=$2,mentions=$3,max_per_run=$4,updated_at=now(),updated_by=$5 where id=true',[s.exclude_inquiry_nos,s.notify_room,s.mentions,s.max_per_run,user.id]);
}
export async function retryBaitoru(id:string) {
 await requireSproutUser();
 return resendBaitoru(id);
}
export async function createPosting(start:string,end:string,content:string) {
 const user=await requireSproutUser();
 if(!validPosting(start,end,content)) throw new Error('掲載の内容を確認してください');
 const r=await queryPg('insert into sprout_baitoru_postings(start_date,end_date,content,created_by) select $1::date,$2::date,$3,$4 where exists(select 1 from sprout_baitoru_settings where id=true and $3=any(content_options)) returning id',[start,end,content,user.id]);
 if(!r.rows.length) throw new Error('掲載内容を選んでください');
}
export async function endPosting(id:string) {
 await requireSproutUser();
 const now=new Date();
 // 初日は日付制約を保ち、終了記録で即時停止する。
 await queryPg('update sprout_baitoru_postings set end_date=greatest(start_date,$2::date),ended_early_at=now() where id=$1 and start_date<=$3::date and end_date>=$3::date and ended_early_at is null',[id,yesterdayJst(now),todayJst(now)]);
}
export async function cancelPosting(id:string) {
 await requireSproutUser();
 await queryPg('delete from sprout_baitoru_postings where id=$1 and start_date>$2::date and ended_early_at is null',[id,todayJst()]);
}
export async function changeContentOption(content:string,remove=false) {
 const user=await requireSproutUser();
 if(typeof content!=='string' || !content.trim() || content.length>200 || typeof remove!=='boolean') throw new Error('掲載内容を確認してください');
 await queryPg(remove ? 'update sprout_baitoru_settings set content_options=array_remove(content_options,$1),updated_at=now(),updated_by=$2 where id=true' : 'update sprout_baitoru_settings set content_options=case when $1=any(content_options) then content_options else array_append(content_options,$1) end,updated_at=now(),updated_by=$2 where id=true',[content.trim(),user.id]);
}
